// src/lucide-react.d.ts
declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  // 定义图标组件的通用属性
  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  // 列出你项目中所有用到的图标
  export const Plus: FC<IconProps>;
  export const Zap: FC<IconProps>;
  export const Home: FC<IconProps>;
  export const BarChart3: FC<IconProps>;
  export const X: FC<IconProps>;
  export const ChevronRight: FC<IconProps>;
  export const Search: FC<IconProps>;
  export const Loader2: FC<IconProps>;
  export const AlertCircle: FC<IconProps>;
  export const ArrowLeft: FC<IconProps>;
  export const TrendingUp: FC<IconProps>;
  export const BarChart2: FC<IconProps>;
  export const PieChart: FC<IconProps>;
  export const Bitcoin: FC<IconProps>;
  export const Activity: FC<IconProps>;
  export const Car: FC<IconProps>;
  export const Blocks: FC<IconProps>;
  export const MoreVertical: FC<IconProps>;
  export const ChevronDown: FC<IconProps>;
  export const ListFilterPlus: FC<IconProps>;
  export const TrendingDown: FC<IconProps>;
  export const Newspaper: FC<IconProps>;
  export const ChevronLeft: FC<IconProps>;
  export const Lock: FC<IconProps>;
  export const Bell: FC<IconProps>;
  export const Moon: FC<IconProps>;
  export const Info: FC<IconProps>;
  export const LogOut: FC<IconProps>;
  export const CircleDollarSign: FC<IconProps>;
  export const ChevronUp: FC<IconProps>;
  export const Send: FC<IconProps>;
  export const Wallet: FC<IconProps>;
  export const User: FC<IconProps>;

  // 可选：允许导入其他未列出的图标（会失去类型提示，但避免报错）
  // export * from 'lucide-react';
}