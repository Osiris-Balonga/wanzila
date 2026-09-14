import type { SVGProps } from "react";
import {
  Bell,
  Bookmark,
  CalendarDays,
  FileText,
  Grid2X2,
  House,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "bell"
  | "bookmark"
  | "calendar"
  | "dashboard"
  | "file"
  | "home"
  | "menu"
  | "pharmacy"
  | "plus"
  | "settings"
  | "shield"
  | "users";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

const icons: Record<IconName, LucideIcon> = {
  bell: Bell,
  bookmark: Bookmark,
  calendar: CalendarDays,
  dashboard: Grid2X2,
  file: FileText,
  home: House,
  menu: Menu,
  pharmacy: Store,
  plus: Plus,
  settings: Settings,
  shield: ShieldCheck,
  users: Users,
};

export function Icon({ name, ...props }: IconProps) {
  const IconComponent = icons[name];
  return <IconComponent aria-hidden="true" focusable="false" {...props} />;
}
