//@ts-nocheck
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import {
  Menu,
  Coins,
  Leaf,
  Search,
  Bell,
  User,
  ChevronDown,
  LogIn,
  LogOut,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { Badge } from "./ui/badge";
import { Web3Auth } from "@web3auth/modal";

import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import {
  createUser,
  getUnreadNotifications,
  getUserBalance,
  getUserByEmail,
  markNotificationAsRead,
} from "@/utils/db/actions";

import { useMediaQuery } from "@/hooks/useMediaQuery";

const clientId = process.env.WEB3_AUTH_CLIENT_ID;

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0xaa36a7", //chain name space for sepolia(can be found on internet)
  rpcTarget: "https://rpc.ankr.com/eth_sepolia",
  displayName: "Sepolia Testnet", //using test net as we are only hosting in local but if we host in production we need main net
  blockExplorerUrl: "https://sepolia.etherscan.io", //this url gives every single transcation that has happned in the sepolia testnet
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://assets.web3auth.io/evm-chains/sepolia.png",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

const web3Auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.TESTNET,
  privateKeyProvider,
});

interface HeaderProps {
  onMenuClick: () => void;
  totalEarnings: number;
}

export default function Header({ onMenuClick, totalEarnings }: HeaderProps) {
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const pathname = usePathname();
  const [notification, setNotification] = useState<Notification[]>([]);
  const [balance, setBalance] = useState(0);
  const isMobile = useMediaQuery("(max-width:768px)"); //this is what you view in your mobile view with max-width(768px) in mobile
  useEffect(() => {
    // this is the use effect that is going to initalize the web3auth and also create the user
    const init = async () => {
      try {
        await web3Auth.initModal();
        setProvider(web3Auth.provider);

        if (web3Auth.connected) {
          //if sepolia net connect
          setLoggedIn(true); // login in is true
          const user = await web3Auth.getUserInfo();
          setUserInfo(user); //user gmail is stored in the setuserInfo if he sign with gmail

          if (user.email) {
            //looking through the user email
            localStorage.setItem("userEmail", user.email); //if email foudn than storing them in localstorage
            try {
              await createUser(user.email, user.name || "Anonymoous user"); //in case the user has no username we give them Anonymoous user
            } catch (error) {
              console.error("Error creating user", error);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing web3auth", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (userInfo && userInfo.email) {
        const user = await getUserByEmail(userInfo.email);
        if (user) {
          const unreadNotifications = await getUnreadNotifications(user.id);
          setNotification(unreadNotifications);
        }
      }
    };
    fetchNotifications();

    const notificationInterval = setInterval(fetchNotifications, 30000); //calling fetch notification function every 30 seconds
    return () => clearInterval(notificationInterval); //we have to clear interval to prevent memory leak or buffer overflow
  }, [userInfo]); // we have a dependency of userInfo for this useEffect

  useEffect(() => {
    const fetchUserBalance = async () => {
      if (userInfo && userInfo.email) {
        const user = await getUserByEmail(userInfo.email);
        if (user) {
          const userBalance = await getUserBalance(user.id);
          setBalance(userBalance);
        }
      }
    };

    fetchUserBalance();

    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener(
      "balanceUpdate",
      handleBalanceUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "balanceUpdate",
        handleBalanceUpdate as EventListener
      );
    };
  }, [userInfo]);

  //the function that is going to handle login
  const login = async () => {
    if (!web3Auth) {
      console.error("Web3Auth is not initialized");
      return;
    }
    try {
      const web3authProvider = await web3Auth.connect(); // this will connect us to the provider
      setProvider(web3authProvider);
      setLoggedIn(true);
      const user = await web3Auth.getUserInfo();
      setUserInfo(user);
      if (user.email) {
        localStorage.setItem("userEmail", user.email);
        try {
          await createUser(user.email, user.name || "Anonymous User");
        } catch (error) {
          console.error("error creating usre", error);
        }
      }
    } catch (error) {
      console.error("Error logging in", error);
    }
  };

  const logout = async () => {
    if (!web3Auth) {
      console.log("Web3Auth is not initialized");
      return;
    }
    try {
      await web3Auth.logout(); //this will help logout
      setProvider(null);
      setLoggedIn(false);
      setUserInfo(null);
      localStorage.removeItem("userEmail");
    } catch (error) {
      console.error("error logging out", error);
    }
  };

  const getUserInfo = async () => {
    if (web3Auth.connected) {
      const user = await web3Auth.getUserInfo();
      setUserInfo(user);

      if (user.email) {
        localStorage.setItem("userEmail", user.email);
        try {
          await createUser(user.email, user.name || "Anonymous User");
        } catch (error) {
          console.error("Error creating a user", error);
        }
      }
    }
  };
  const handleNotificationClick = async (notificationId: number) => {
    await markNotificationAsRead(notificationId);
  };
  if (loading) {
    return <div>Loading web3 auth....</div>;
  }

  return (
    <header className="bg-white border-b-2 border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:mr-4"
            onClick={onMenuClick}
          >
            <Menu className="h-6 w-6 text-gray-800" />
          </Button>
          <Link href="/" className="flex items-center">
            <Leaf className="h-6 w-6 md:h-8 md:w-8 text-green-500 mr-1 md:mr-2" />
            {/* this scustomizes the icon */}
            <span className="font-bold text-base md:text-lg text-gray-800">
              {/* this is for wastesnap font cutomization */}
              WasteSnap
            </span>
          </Link>
        </div>
        {!isMobile && ( //to create the search bar and icon(for desktop only)
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="search ..."
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 "
              />
              {/* search bar and it customization for when clicken changes to green */}
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              {/* this is the search icon inside the search bar */}
            </div>
          </div>
        )}
        <div className="flex items-center">
          {isMobile && ( //for mobile only
            <Button variant="ghost" size="icon" className="mr-2">
              <Search className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 relative">
                <Bell className="h-5 w-5 text-gray-500" />
                {/* this displays the bell icon */}
                {notification.length > 0 && ( //if something is comming from the notification that is unread
                  <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5">
                    {notification.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              {notification.length > 0 ? ( // this will display all the unread nofitication fetching from the database
                notification.map((notification: any) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.id)} // when the unread notificaiton is click it is set to default notification state
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{notification.type}</span>
                      <span className="text-sm text-gray-500">
                        {notification.message}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                // this is the else case when there is no new notificaiton (default case )
                <DropdownMenuItem>No new notification</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* creates the coins icon and coins amount for the user */}
          <div className="mr-2 md:mr-4 flex items-center bg-gray-100 roundeed-full px-2 md:px-3 py-1">
            {/* customizing the coin icon  */}
            <Coins className="h-4 w-4 md:h-5 md:w-5 mr-1 text-green-500" />
            {/* customizing the number icon  */}
            <span className="font-semibold text-sm md:text-base text-gray-800">
              {/* setting it to 2 decimal  */}
              {balance.toFixed(2)}
            </span>
          </div>
          {!loggedIn ? ( // setting the log In icon (if the user is not logged in show the user LogIn button)
            <Button
              // on click runs the login fucntion
              onClick={login}
              className="bg-green-600 hover:bg-green-700 text-white text-sm md:text-base"
            >
              Login
              {/* login icon from lucid react */}
              <LogIn className="ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5" />
            </Button>
          ) : (
            // If the user is logged in show this(show the user profile icon and dropdown of user information including "logout button")
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="items-center flex"
                >
                  <User className="h-5 w-5 mr-1" />
                  <ChevronDown className="h-4 w-4 " />
                </Button>
              </DropdownMenuTrigger>
              {/* dropdown menu content after the icon is clicked */}
              {/* display the user info */}
              <DropdownMenuContent align="end">
                {/* fetch user info */}
                <DropdownMenuItem onClick={getUserInfo}>
                  {/* displays the user name fetching from the database if available */}
                  {userInfo ? userInfo.name : "Profile"}
                </DropdownMenuItem>
                {/* display the settings and redirect to the settings page  */}
                <DropdownMenuItem>
                  <Link href={"/settings"}>Settings</Link>
                </DropdownMenuItem>
                {/* display the logout and trigger the logout function*/}
                <DropdownMenuItem onClick={logout}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
