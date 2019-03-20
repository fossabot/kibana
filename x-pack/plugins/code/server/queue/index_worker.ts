/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import moment from 'moment';

import { IndexStats, IndexWorkerResult, RepositoryUri, WorkerProgress } from '../../model';
import { GitOperations } from '../git_operations';
import { IndexerFactory, IndexProgress } from '../indexer';
import { EsClient, Esqueue } from '../lib/esqueue';
import { Logger } from '../log';
import { RepositoryObjectClient } from '../search';
import { ServerOptions } from '../server_options';
import { aggregateIndexStats } from '../utils/index_stats_aggregator';
import { AbstractWorker } from './abstract_worker';
import { CancellationSerivce } from './cancellation_service';
import { Job } from './job';

export class IndexWorker extends AbstractWorker {
  public id: string = 'index';
  private objectClient: RepositoryObjectClient;

  constructor(
    protected readonly queue: Esqueue,
    protected readonly log: Logger,
    protected readonly client: EsClient,
    protected readonly indexerFactories: IndexerFactory[],
    protected readonly options: ServerOptions,
    private readonly cancellationService: CancellationSerivce
  ) {
    super(queue, log);

    this.objectClient = new RepositoryObjectClient(this.client);
  }

  public async executeJob(job: Job) {
    const { payload, cancellationToken } = job;
    const { uri, revision } = payload;
    const indexerNumber = this.indexerFactories.length;

    // Binding the index cancellation logic
    this.cancellationService.cancelIndexJob(uri);
    const indexPromises: Array<Promise<IndexStats>> = this.indexerFactories.map(
      (indexerFactory: IndexerFactory, index: number) => {
        const indexer = indexerFactory.create(uri, revision);
        if (cancellationToken) {
          cancellationToken.on(() => {
            indexer.cancel();
          });
          this.cancellationService.registerIndexJobToken(uri, cancellationToken);
        }
        const progressReporter = this.getProgressReporter(uri, revision, index, indexerNumber);
        return indexer.start(progressReporter);
      }
    );
    const stats: IndexStats[] = await Promise.all(indexPromises);
    const res: IndexWorkerResult = {
      uri,
      revision,
      stats: aggregateIndexStats(stats),
    };
    this.log.info(`Index worker finished with stats: ${JSON.stringify([...res.stats])}`);
    return res;
  }

  public async onJobEnqueued(job: Job) {
    const { uri, revision } = job.payload;
    const progress: WorkerProgress = {
      uri,
      progress: 0,
      timestamp: new Date(),
      revision,
    };
    return await this.objectClient.setRepositoryLspIndexStatus(uri, progress);
  }

  public async updateProgress(uri: RepositoryUri, progress: number) {
    const p: WorkerProgress = {
      uri,
      progress,
      timestamp: new Date(),
    };
    try {
      return await this.objectClient.updateRepositoryLspIndexStatus(uri, p);
    } catch (error) {
      this.log.error(`Update index progress error.`);
      this.log.error(error);
    }
  }

  protected async getTimeoutMs(payload: any) {
    try {
      const gitOperator = new GitOperations(this.options.repoPath);
      const totalCount = await gitOperator.countRepoFiles(payload.uri, 'head');
      let timeout = moment.duration(1, 'hour').asMilliseconds();
      if (totalCount > 0) {
        // timeout = ln(file_count) in hour
        // e.g. 10 files -> 2.3 hours, 100 files -> 4.6 hours, 1000 -> 6.9 hours, 10000 -> 9.2 hours
        timeout = moment.duration(Math.log(totalCount), 'hour').asMilliseconds();
      }
      this.log.info(`Set index job timeout to be ${timeout} ms.`);
      return timeout;
    } catch (error) {
      this.log.error(`Get repo file total count error.`);
      this.log.error(error);
      throw error;
    }
  }

  private getProgressReporter(
    repoUri: RepositoryUri,
    revision: string,
    index: number,
    total: number
  ) {
    return async (progress: IndexProgress) => {
      const p: WorkerProgress = {
        uri: repoUri,
        progress: progress.percentage,
        timestamp: new Date(),
        revision,
      };
      return await this.objectClient.setRepositoryLspIndexStatus(repoUri, p);
    };
  }
}