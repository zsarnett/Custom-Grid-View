import { LovelaceConfig } from 'custom-card-helpers/dist/types';

export const replaceView = (config: LovelaceConfig, viewIndex: number, viewConfig: any): LovelaceConfig => ({
  ...config,
  views: config.views.map((origView, index) => (index === viewIndex ? viewConfig : origView)),
});

/* eslint-disable @typescript-eslint/explicit-function-return-type */
export const afterNextRender = (cb: () => void): void => {
  requestAnimationFrame(() => setTimeout(cb, 0));
};

export const nextRender = () => {
  return new Promise(resolve => {
    afterNextRender(resolve);
  });
};
