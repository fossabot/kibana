/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import {
  EmbeddableFactoriesRegistryProvider,
  EmbeddableFactory,
} from '../../../../src/legacy/core_plugins/embeddable_api/public';

import 'ui/autoload/all';
import 'uiExports/embeddableFactories';

import uiRoutes from 'ui/routes';

// @ts-ignore
import { uiModules } from 'ui/modules';
import template from './index.html';

export interface PluginShim {
  embeddables: {
    getEmbeddableFactory: <I, O>(type: string) => EmbeddableFactory<I, O> | undefined;
  };
}

export interface CoreShim {
  onRenderComplete: (listener: () => void) => void;
}

const pluginShim: PluginShim = {
  embeddables: {
    getEmbeddableFactory: () => undefined,
  },
};
const rendered = false;
const onRenderCompleteListeners: Array<() => void> = [];
const coreShim: CoreShim = {
  onRenderComplete: (renderCompleteListener: () => void) => {
    if (rendered) {
      renderCompleteListener();
    } else {
      onRenderCompleteListeners.push(renderCompleteListener);
    }
  },
};

// uiRoutes.enable();
// uiRoutes.defaults(/\embeddable_action_editor/, {});
// uiRoutes.when('/', {
//   template,
//   controller($scope, config, indexPatterns, Private) {
//     // @ts-ignore
//     const embeddableFactories = Private(EmbeddableFactoriesRegistryProvider);

//     pluginShim.embeddables.getEmbeddableFactory = (type: string) =>
//       embeddableFactories.byName[type];

//     $scope.$$postDigest(() => {
//       rendered = true;
//       onRenderCompleteListeners.forEach(listener => listener());
//     });
//   },
// });

export function createShim(): { core: CoreShim; plugins: PluginShim } {
  return {
    core: coreShim,
    plugins: pluginShim,
  };
}
