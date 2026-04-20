import { useEffect, useOptimistic, useState } from "react";
import loadingStatus from "../helpers/loadingStatus";

const useBids = (houseId) => {
  const [bids, setBids] = useState([]);
  const [loadingState, setLoadingState] = useState(loadingStatus.isLoading);
  const [optimisticBids, addOptimisticBid] = useOptimistic(
    bids,
    (bids, newbid) => [...bids, newbid],
  );

  useEffect(() => {
    const fetchBids = async () => {
      setLoadingState(loadingStatus.isLoading);
      try {
        const response = await fetch(`https://localhost:56369/bid/${houseId}`);
        const bids = await response.json();
        setBids(bids);
        setLoadingState(loadingStatus.loaded);
      } catch {
        setLoadingState(loadingStatus.hasErrored);
      }
    };

    fetchBids();
  }, [houseId]);

  const postBid = async (bid) => {
    const rsp = await fetch("https://localhost:56369/bid", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bid),
    });
    return await rsp.json();
  };

  const addBid = async (bid) => {
    addOptimisticBid(bid);
    const postedBid = await postBid(bid);
    setBids([...bids, postedBid]);
  };

  return { bids: optimisticBids, loadingState, addBid };
};

export default useBids;
