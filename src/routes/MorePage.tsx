import { MenuLinkRow } from '@/components/MenuLinkRow'
import { SoonRow } from '@/components/SoonRow'

/**
 * The menu surface to everything not on a primary tab (`.gsd/user-flows.md`
 * §2.4). Settings is one row here, not a whole tab.
 *
 * Rows ship in final approved order with the unbuilt ones disabled, so a later
 * story enables its own row in a one-line diff and never re-sorts the menu.
 * `/more/settings` and `/more/library` are nested paths but NOT nested UI -
 * there is deliberately no `<Outlet />` on this screen.
 */
export function MorePage() {
  return (
    <div className="pt-6">
      <h1 className="text-2xl font-semibold">More</h1>

      <ul className="mt-6 divide-y divide-border border-y border-border">
        <li>
          <MenuLinkRow to="/more/settings" label="Settings" />
        </li>
        <li>
          <MenuLinkRow to="/more/library" label="Exercise Library" />
        </li>
        <li>
          <SoonRow label="Progress photos" />
        </li>
        <li>
          <SoonRow label="Body measurements" />
        </li>
        <li>
          <SoonRow label="Data & export" />
        </li>
      </ul>
    </div>
  )
}
