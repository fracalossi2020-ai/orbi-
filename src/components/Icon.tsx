import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import {
  ArrowLeft, ArrowRight, Bandaids, Briefcase, CalendarBlank, House, Lightning, Bell, CarProfile, ChartLineUp, ChatCircleDots, Check, ClockCounterClockwise, Crosshair, Drop, FileText,
  GearSix, Gift, List, LockSimple, MapPin, MapTrifold, Megaphone, Moon, Motorcycle, Package, Path, Plus, Question, Receipt, Scales,
  ShareNetwork, ShieldCheck, SignOut, Siren, Sparkle, Stack, Star, SteeringWheel, Storefront, Sun, Ticket, Tire, Truck, User, Users,
  Wallet, Wrench, X, Money, QrCode, CreditCard, DeviceMobile, Copy, NavigationArrow, MagnifyingGlass, FirstAidKit, AirplaneTilt, GraduationCap, Bank, Tree, Factory, Church, SoccerBall, Bus,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Ícones Phosphor (licença MIT), com nomes próprios do projeto. O peso muda o estilo:
 * "regular" no uso comum, "fill" no item ativo, "duotone" em destaques.
 */
const ICONS: Record<string, PhosphorIcon> = {
  menu: List, close: X, arrow: ArrowRight, back: ArrowLeft, pin: MapPin, locate: Crosshair, car: CarProfile, moto: Motorcycle,
  user: User, users: Users, wallet: Wallet, history: ClockCounterClockwise, help: Question, shield: ShieldCheck, sos: Siren,
  share: ShareNetwork, chat: ChatCircleDots, star: Star, bell: Bell, sun: Sun, moon: Moon, wrench: Wrench, tire: Tire,
  patch: Bandaids, oil: Drop, wash: Sparkle, tow: Truck, route: Path, layers: Stack, scale: Scales, receipt: Receipt,
  chart: ChartLineUp, ticket: Ticket, megaphone: Megaphone, store: Storefront, map: MapTrifold, settings: GearSix, doc: FileText,
  check: Check, plus: Plus, logout: SignOut, gift: Gift, lock: LockSimple, package: Package, steering: SteeringWheel,
  home: House, briefcase: Briefcase, calendar: CalendarBlank, bolt: Lightning, search: MagnifyingGlass, money: Money, qr: QrCode, card: CreditCard, phone: DeviceMobile, copy: Copy, navigation: NavigationArrow,
  hospital: FirstAidKit, airport: AirplaneTilt, school: GraduationCap, civic: Bank, park: Tree, factory: Factory, church: Church, stadium: SoccerBall, bus: Bus,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, className = "", weight = "regular" }: { name: string; size?: number; className?: string; weight?: IconWeight }) {
  // "prumo" era o símbolo antigo; hoje mostra o pino de destino (MapPin).
  if (name === "prumo") return <MapPin size={size} weight={weight} className={`shrink-0 ${className}`} aria-hidden="true" />;
  const Glyph = ICONS[name] ?? Question;
  return <Glyph size={size} weight={weight} className={`shrink-0 ${className}`} aria-hidden="true" />;
}
