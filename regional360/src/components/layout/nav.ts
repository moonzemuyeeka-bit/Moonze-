import {
  BarChart3,
  Bot,
  Building2,
  FileText,
  GaugeCircle,
  LayoutDashboard,
  Megaphone,
  Radar,
  Settings,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AIModule } from "@/lib/ai/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: AIModule;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/performance", label: "Performance", icon: GaugeCircle, module: "performance" },
  { href: "/pipeline", label: "Sales Pipeline", icon: Target, module: "pipeline" },
  { href: "/team", label: "Team", icon: Users, module: "team" },
  { href: "/accounts", label: "Accounts", icon: Building2, module: "accounts" },
  { href: "/market", label: "Market Radar", icon: Radar, module: "market" },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, module: "campaigns" },
  { href: "/actions", label: "Actions", icon: BarChart3, module: "actions" },
  { href: "/copilot", label: "AI Copilot", icon: Bot, module: "general" },
  { href: "/reports", label: "Reports", icon: FileText, module: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, module: "general" },
];
