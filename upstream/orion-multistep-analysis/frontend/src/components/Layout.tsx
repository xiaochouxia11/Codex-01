import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { ReactNode } from "react";

import "@/styles/layout.css";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <h1 className="app-logo">
          <span className="app-logo__mark">MRAAF</span>
          <span className="app-logo__tag">
            Multistep Research &amp; Analysis Agentic Framework — an extensible and general-purpose version of
            ORION
          </span>
        </h1>
        <nav className="app-nav">
          <NavLink className={({ isActive }) => clsx("app-nav__link", { active: isActive })} to="/runs">
            Runs
          </NavLink>
          <NavLink className={({ isActive }) => clsx("app-nav__link", { active: isActive })} to="/prompts">
            Prompts
          </NavLink>
          <NavLink className={({ isActive }) => clsx("app-nav__link", { active: isActive })} to="/datasets">
            Datasets
          </NavLink>
        </nav>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
};

export default Layout;
