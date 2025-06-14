import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, Settings, User, Menu } from "lucide-react";

const Navbar = ({onMenuClick}) => {
  const { logout, authUser } = useAuthStore();

  return (
    <header className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 backdrop-blur-lg bg-opacity-80">
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden mr-1 p-1 rounded-md hover:bg-base-200 focus:outline-none"
              onClick={onMenuClick}
              aria-label="Open sidebar menu"
            >
              <Menu size={22} />
            </button>

            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <img
                  src="/Logo - Trans.png"
                  alt="SunoSuno Logo"
                  className="w-7 h-7 object-cover"
                />
              </div>
              <h1 className="text-lg font-bold text-base-content">SunoSuno</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={"/settings"}
              className="btn btn-sm btn-ghost gap-2 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <>
                <Link to={`/profile/${authUser._id}`} className="btn btn-sm btn-ghost gap-2">
                  <User className="size-5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button className="btn btn-sm btn-ghost gap-2" onClick={logout}>
                  <LogOut className="size-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
