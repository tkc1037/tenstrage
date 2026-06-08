import React from 'react';
import { Composition, registerRoot, type CalculateMetadataFunction } from 'remotion';
import { TaxiVideo } from './TaxiVideo';
import { C } from './common';
import type { TaxiVideoProps } from './TaxiVideo';

// デフォルトprops（bgStyleのみ変えてテーマ切り替え可能なコンポジション群）
const baseProps = {
  title: '東京タクシードライバーの年収は？',
  hook: '月収50万円も夢じゃない',
  lines: [
    '平均年収: 400〜500万円',
    '歩合制で稼げる上限なし',
    '入社祝い金: 最大50万円',
    '未経験・二種免許取得サポートあり',
  ],
  cta: '詳細はプロフのリンクをチェック👆',
};

const calculateMetadata: CalculateMetadataFunction<TaxiVideoProps> = ({ props }) => ({
  durationInFrames: props.timing?.totalFrames ?? 900,
  props,
});

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TaxiVideo"
      component={TaxiVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ ...baseProps, bgStyle: 'bokeh', accentColor: C.gold }}
      calculateMetadata={calculateMetadata}
    />
  );
};

registerRoot(RemotionRoot);
