import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { TaxiVideo } from './TaxiVideo';
import { C } from './common';

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

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── メイン（bokeh・ゴールド） ─── */}
      <Composition
        id="TaxiVideo"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'bokeh', accentColor: C.gold }}
      />

      {/* ── オーロラ（インディゴ） ─── */}
      <Composition
        id="TaxiVideo-Aurora"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'aurora', accentColor: C.accent }}
      />

      {/* ── 波（シアン） ─── */}
      <Composition
        id="TaxiVideo-Waves"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'waves', accentColor: C.cyan }}
      />

      {/* ── グリッド（白・テック系） ─── */}
      <Composition
        id="TaxiVideo-Grid"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'grid', accentColor: C.white }}
      />

      {/* ── 幾何学（オレンジ） ─── */}
      <Composition
        id="TaxiVideo-Geometric"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'geometric', accentColor: C.orange }}
      />

      {/* ── グラデーション（ピンク） ─── */}
      <Composition
        id="TaxiVideo-Gradient"
        component={TaxiVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...baseProps, bgStyle: 'gradient', accentColor: C.secondary }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
