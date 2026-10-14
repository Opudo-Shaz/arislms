/**
 * Light / dark / auto colour-mode dropdown for the header. Shared by the
 * staff (AppHeader) and client portal (ClientHeader) layouts.
 *
 * @component
 */

import React from 'react'
import { CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle, useColorModes } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilContrast, cilMoon, cilSun } from '@coreui/icons'

const MODES = [
  { key: 'light', label: 'Light', icon: cilSun },
  { key: 'dark', label: 'Dark', icon: cilMoon },
  { key: 'auto', label: 'Auto', icon: cilContrast },
]

const ThemeSwitcher = () => {
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const current = MODES.find((m) => m.key === colorMode) || MODES[0]

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false} aria-label="Change colour theme">
        <CIcon icon={current.icon} size="lg" />
      </CDropdownToggle>
      <CDropdownMenu>
        {MODES.map((mode) => (
          <CDropdownItem
            key={mode.key}
            active={colorMode === mode.key}
            className="d-flex align-items-center"
            as="button"
            type="button"
            onClick={() => setColorMode(mode.key)}
          >
            <CIcon className="me-2" icon={mode.icon} size="lg" /> {mode.label}
          </CDropdownItem>
        ))}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default ThemeSwitcher
