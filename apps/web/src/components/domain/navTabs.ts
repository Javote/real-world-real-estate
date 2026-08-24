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
  ShoppingBag,
  TrendingUp,
  User
} from 'lucide-react'
import type { TranslationKey } from '#/i18n/dictionary'
import type { NavTab } from './BottomNav'

// Las cuatro composiciones del BottomNav, textuales de M2-D3 §Usage rules y
// coincidentes con los árboles de pantallas de M2-D1.
//
// Viven acá y no dentro de cada pantalla porque **son normativas**: el orden y
// la cantidad de tabs son parte del entregable, no una decisión de la pantalla
// que las monta. Que estén juntas hace que un cambio se vea de una y que el
// test las pueda comparar contra el documento.
//
// Los labels son CLAVES, no texto (D-025): la pantalla las traduce.

type TabSpec = Omit<NavTab, 'label'> & { labelKey: TranslationKey }

export const NAV_TABS: Record<'investor' | 'developer' | 'notary' | 'certifier', TabSpec[]> = {
  // INV: Menu · Favorites · Buy (FAB) · Units · User
  investor: [
    { to: '/investor/menu', labelKey: 'nav.investor.menu', icon: Menu },
    { to: '/investor/favorites', labelKey: 'nav.investor.favorites', icon: Heart },
    { to: '/investor/buy', labelKey: 'nav.investor.buy', icon: ShoppingBag, fab: true },
    { to: '/investor/units', labelKey: 'nav.investor.units', icon: Home },
    { to: '/investor/profile', labelKey: 'nav.investor.user', icon: User }
  ],
  // DEV: Panel · Projects · Capital · Units · Progress
  developer: [
    { to: '/developer', labelKey: 'nav.developer.panel', icon: LayoutGrid },
    { to: '/developer/projects', labelKey: 'nav.developer.projects', icon: Building2 },
    { to: '/developer/capital', labelKey: 'nav.developer.capital', icon: DollarSign },
    { to: '/developer/units', labelKey: 'nav.developer.units', icon: Home },
    { to: '/developer/progress', labelKey: 'nav.developer.progress', icon: TrendingUp }
  ],
  // NOT: Panel · Dossiers · Signed · Profile
  notary: [
    { to: '/notary', labelKey: 'nav.notary.panel', icon: LayoutGrid },
    { to: '/notary/dossiers', labelKey: 'nav.notary.dossiers', icon: FileCheck2 },
    { to: '/notary/signed', labelKey: 'nav.notary.signed', icon: FileSignature },
    { to: '/notary/profile', labelKey: 'nav.notary.profile', icon: User }
  ],
  // CER: Panel · Assigned · Issued · Profile
  certifier: [
    { to: '/certifier', labelKey: 'nav.certifier.panel', icon: LayoutGrid },
    { to: '/certifier/assigned', labelKey: 'nav.certifier.assigned', icon: ClipboardCheck },
    { to: '/certifier/issued', labelKey: 'nav.certifier.issued', icon: FileCheck2 },
    { to: '/certifier/profile', labelKey: 'nav.certifier.profile', icon: User }
  ]
}
