import { NavLink } from "react-router-dom";

const DEFAULT_TABS = [
  { to: "/", icon: "📊", label: "Dashboard", end: true },
  { to: "/kot", icon: "🎫", label: "KOT", badgeKey: "kot" },
  { to: "/inventory", icon: "📦", label: "Inventory" },
  { to: "/orders", icon: "🛒", label: "Orders" },
  { to: "/profile", icon: "👤", label: "Profile" },
];

export default function BottomTab({
  kotCount = 0,
  tabs = DEFAULT_TABS,
  badgeCounts = {},
}) {
  const resolvedBadgeCounts = {
    kot: kotCount,
    ...badgeCounts,
  };

  return (
    <div
      className="absolute bottom-0 flex w-full items-stretch border-t border-border bg-surface px-1 pb-4"
      style={{ height: "82px" }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end ?? tab.to === "/"}
          className={({ isActive }) =>
            `relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl pt-2 transition-all ${
              isActive ? "text-accent" : "text-text-muted"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`text-[22px] transition-transform ${
                  isActive ? "scale-110" : ""
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  isActive ? "text-accent" : "text-text-muted"
                }`}
              >
                {tab.label}
              </span>
              {tab.badgeKey && resolvedBadgeCounts[tab.badgeKey] > 0 && (
                <span className="absolute right-[calc(50%-14px)] top-[5px] h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-red-500" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
