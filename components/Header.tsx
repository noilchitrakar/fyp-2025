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
  getUserByEmail,
  getUnreadNotifications,
  getUserBalance,
  getRewardTransactions,
} from "@/utils/db/action";

// import {useMediaQuery} from "@/hooks/useMediaQuery";

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
  //   const isMobile = useMediaQuery("(max-width:768px)");
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
        </div>
      </div>
    </header>
  );
}
