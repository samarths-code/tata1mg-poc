import UploadIcon from "../icons/NetworkStats/UploadIcon"
import DownloadIcon from "../icons/NetworkStats/DownloadIcon"
import RefreshIcon from "../icons/NetworkStats/RefreshIcon"
import RefreshCheck from "../icons/NetworkStats/RefreshCheck"
import { getNetworkStats } from "@videosdk.live/react-sdk";
import WifiOff from "../icons/NetworkStats/WifiOff";
import { useEffect, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";

const NetworkStats = ({ }) => {
  const [error, setError] = useState("no-error-loading")
  const [uploadSpeed, setUploadSpeed] = useState(null)
  const [downloadSpeed, setDownloadSpeed] = useState(null)
  const isMobile = useIsMobile()

  useEffect(() => { getNetworkStatistics(); }, [])

  const getNetworkStatistics = async () => {
    setError("no-error-loading");
    try {
      const options = { timeoutDuration: 45000 }; // Set a custom timeout of 45 seconds
      const networkStats = await getNetworkStats(options);
      if (networkStats) {
        setError("no-error");
      }
      setDownloadSpeed(networkStats["downloadSpeed"]);
      setUploadSpeed(networkStats["uploadSpeed"])
    } catch (ex) {
      if (ex === "Not able to get NetworkStats due to no Network") {
        setError("no-wifi")
      }
      if (ex === "Not able to get NetworkStats due to timeout") {
        setError("timeout")
      }
      console.log("Error in networkStats: ", ex);
    }
  }
  
  const handleOnClick = () => {
    getNetworkStatistics()
  }
  
  return (
    <>
      <div className="flex flex-row auto-cols-max border border-orange-100 divide-x divide-orange-100 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm h-9">

        {error === "no-error-loading" &&
          <div className="group inline-flex items-center gap-2 text-xs text-gray-500 px-3">
            Checking network…
            <RefreshCheck />
          </div>
        }

        {error === "no-error" &&
          <>
            <div className={`group inline-flex items-center gap-1.5 text-xs text-gray-600 px-2 basis-1/2 ${!isMobile && "w-28"}`}>
              <DownloadIcon />
              {downloadSpeed} Mbps
            </div>
            <div className={`group inline-flex items-center gap-1.5 text-xs text-gray-600 px-2 basis-1/2 ${!isMobile && "w-28"}`}>
              <UploadIcon />
              {uploadSpeed} Mbps
            </div>
            <div className="basis-1/6 flex items-center justify-center px-2 cursor-pointer" onClick={handleOnClick}>
              <RefreshIcon />
            </div>
          </>
        }

        {error === "no-wifi" &&
          <>
            <div className="group inline-flex items-center gap-2 text-xs text-red-500 px-2 py-1">
              <WifiOff />
              You're offline!
            </div>
            <div className="flex items-center justify-center px-2 cursor-pointer" onClick={handleOnClick}>
              <RefreshIcon />
            </div>
          </>
        }

        {error === "timeout" &&
          <>
            <div className="group inline-flex items-center gap-2 text-xs text-red-500 px-2 py-1">
              Network check failed
            </div>
            <div className="flex items-center justify-center px-2 cursor-pointer" onClick={handleOnClick}>
              <RefreshIcon />
            </div>
          </>
        }

      </div>
    </>
  )
}

export default NetworkStats