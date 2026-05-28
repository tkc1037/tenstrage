import { Composition } from 'remotion';
import { TaxiVideo } from './TaxiVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TaxiVideo"
      component={TaxiVideo}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1080}
      defaultProps={{
        title: '東京タクシードライバーの年収は？',
        lines: [
          '平均年収: 400〜500万円',
          '歩合制で稼げる上限なし',
          '入社祝い金: 最大50万円',
        ],
      }}
    />
  );
};
