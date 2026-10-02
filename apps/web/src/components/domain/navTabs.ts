import {
  Building2,
  ClipboardCheck,
  DollarSign,
  FileCheck2,
  FileSignature,
  Heart,
  Home,
  LayoutGrid,
  Menu,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  User
} from 'lucide-react'
import type { TranslationKey } from '#/i18n/dictionary'
import type { NavTab } from './BottomNav'

type TabSpec = Omit<NavTab, 'label'> & { labelKey: TranslationKey }

export const NAV_TABS: Record<
  'investor' | 'developer' | 'notary' | 'certifier' | 'admin',
  TabSpec[]
> = {
  investor: [
    { to: '/investor/menu', labelKey: 'nav.investor.menu', icon: Menu },
    { to: '/investor/favorites', labelKey: 'nav.investor.favorites', icon: Heart },
    { to: '/investor/buy', labelKey: 'nav.investor.buy', icon: ShoppingBag, fab: true },
    { to: '/investor/units', labelKey: 'nav.investor.units', icon: Home },
    { to: '/investor/profile', labelKey: 'nav.investor.user', icon: User }
  ],
  developer: [
    { to: '/developer', labelKey: 'nav.developer.panel', icon: LayoutGrid },
    { to: '/developer/projects', labelKey: 'nav.developer.projects', icon: Building2 },
    { to: '/developer/capital', labelKey: 'nav.developer.capital', icon: DollarSign },
    { to: '/developer/units', labelKey: 'nav.developer.units', icon: Home },
    { to: '/developer/progress', labelKey: 'nav.developer.progress', icon: TrendingUp }
  ],
  notary: [
    { to: '/notary', labelKey: 'nav.notary.panel', icon: LayoutGrid },
    { to: '/notary/dossiers', labelKey: 'nav.notary.dossiers', icon: FileCheck2 },
    { to: '/notary/signed', labelKey: 'nav.notary.signed', icon: FileSignature },
    { to: '/notary/profile', labelKey: 'nav.notary.profile', icon: User }
  ],
  certifier: [
    { to: '/certifier', labelKey: 'nav.certifier.panel', icon: LayoutGrid },
    { to: '/certifier/assigned', labelKey: 'nav.certifier.assigned', icon: ClipboardCheck },
    { to: '/certifier/issued', labelKey: 'nav.certifier.issued', icon: FileCheck2 },
    { to: '/certifier/profile', labelKey: 'nav.certifier.profile', icon: User }
  ],
  admin: [
    { to: '/admin', labelKey: 'nav.admin.panel', icon: ShieldCheck },
    { to: '/investor/buy', labelKey: 'nav.admin.investor', icon: ShoppingBag },
    { to: '/developer', labelKey: 'nav.admin.developer', icon: Building2 },
    { to: '/certifier', labelKey: 'nav.admin.certifier', icon: ClipboardCheck },
    { to: '/notary', labelKey: 'nav.admin.notary', icon: FileSignature }
  ]
}
