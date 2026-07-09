import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

declare module "lucide-react" {
  interface ElementAttributes extends RefAttributes<SVGSVGElement>, Partial<SVGProps<SVGSVGElement>> {}
  interface LucideProps extends ElementAttributes {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }
  type LucideIconType = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

  export const ArrowLeft: LucideIconType;
  export const Building2: LucideIconType;
  export const CheckCheck: LucideIconType;
  export const ChevronDown: LucideIconType;
  export const Crown: LucideIconType;
  export const EyeOff: LucideIconType;
  export const FileImage: LucideIconType;
  export const FileText: LucideIconType;
  export const Filter: LucideIconType;
  export const Image: LucideIconType;
  export const Info: LucideIconType;
  export const Reply: LucideIconType;
  export const Rocket: LucideIconType;
  export const ShieldAlert: LucideIconType;
  export const ShieldCheck: LucideIconType;
  export const Star: LucideIconType;
  export const Tv: LucideIconType;
  export const Unlock: LucideIconType;
  export const UserPlus: LucideIconType;
  export const Video: LucideIconType;
  export const XCircle: LucideIconType;
  export const XIcon: LucideIconType;
  export const Edit2: LucideIconType;
  export const Lock: LucideIconType;
  export const ArrowUpRight: LucideIconType;
  export const Settings2: LucideIconType;
}
