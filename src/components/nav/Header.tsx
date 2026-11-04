import { DropdownModal } from "#/components/dropdown/DropdownModal";
import { HeaderSearch } from "#/components/search/HeaderSearch";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

interface NavItemBase {
    label: string;
    type: "link" | "dropdown";
}

interface NavItemLink extends NavItemBase {
    type: "link";
    href: string;
}

interface NavItemDropdown extends NavItemBase {
    type: "dropdown";
    dropdownItems: Array<NavItemLink>;
}

type NavItem = NavItemLink | NavItemDropdown;

const BROWSE_BY_NAV_ITEMS: Array<NavItemLink> = [
    { label: "Track", href: "/tracks", type: "link" },
    { label: "Motif", href: "/motifs", type: "link" },
    { label: "Activity", href: "/activities", type: "link" },
    { label: "Release", href: "/releases", type: "link" },
    { label: "Album", href: "albums", type: "link" },
];

const NAV_ITEMS: Array<NavItem> = [
    {
        label: "Browse By",
        type: "dropdown",
        dropdownItems: BROWSE_BY_NAV_ITEMS,
    },
    {
        label: "About",
        href: "/about",
        type: "link",
    },
];

export const Header = () => {
    const [showDropdown, setShowDropdown] = useState(false);

    return (
        <header className="flex max-w-full items-center gap-9 border-b border-overlay-1 px-7 py-5">
            <Link
                to="/"
                className="font-sans text-[13px] tracking-[0.34em] text-text"
            >
                PARACHORAL
                <span className="tracking-[0.2em] text-accent">.FM</span>
            </Link>

            <nav
                aria-label="Primary"
                className="ml-auto gap-6 md:flex flex items-center"
            >
                {NAV_ITEMS.map((item) =>
                    item.type === "link" ? (
                        <div className="inline-block" key={item.label}>
                            <Link
                                to={item.href}
                                preload="intent"
                                preloadIntentProximity={30}
                                className="font-sans text-[11px] font-light uppercase tracking-[0.28em] text-subtext-1 transition-colors duration-200 hover:text-accent"
                            >
                                {item.label}
                            </Link>
                        </div>
                    ) : (
                        <DropdownModal
                            buttonComponent={
                                <div className="font-sans text-[11px] font-light uppercase tracking-[0.28em] text-subtext-1 transition-colors duration-200 hover:text-accent">
                                    {item.label}
                                </div>
                            }
                            className="flex flex-col gap-3 bg-surface0 border-overlay-1 border p-3 mt-2 ml-1"
                            key={item.label}
                            showDropdownState={showDropdown}
                            setShowDropdownState={setShowDropdown}
                        >
                            {item.dropdownItems.map((dropdownItem) => (
                                <Link
                                    to={dropdownItem.href}
                                    className="font-sans text-[11px] font-light uppercase tracking-[0.28em] text-subtext-1 transition-colors duration-200 hover:text-accent"
                                    onClick={() => setShowDropdown(false)}
                                    key={dropdownItem.label}
                                >
                                    {dropdownItem.label}
                                </Link>
                            ))}
                        </DropdownModal>
                    ),
                )}
            </nav>

            <HeaderSearch />
            <Link
                to="/search"
                aria-label="Search the songbook"
                className="text-subtext-1 transition-colors duration-200 hover:text-accent md:hidden"
            >
                <MagnifyingGlassIcon size={16} />
            </Link>
        </header>
    );
};
