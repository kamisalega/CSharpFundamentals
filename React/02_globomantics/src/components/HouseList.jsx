import { useEffect, useRef, useState } from "react";
import HouseRow from "./HouseRow";

const HouseList = () => {
  const [houses, setHouses] = useState([]);
  const counter = useRef(0);

  useEffect(() => {
    const fetchHouses = async () => {
      const response = await fetch("https://localhost:56369/house");
      const houses = await response.json();
      setHouses(houses);
    };
    fetchHouses();
    counter.current++;
  }, []);

  const addHouse = () => {
    setHouses([
      ...houses,
      {
        id: 6,
        address: "32 Valley Way, New York",
        country: "USA",
        price: 1000000,
      },
    ]);
  };
  return (
    <>
      <div className="row mb-2">
        <h5 className="themeFontColor text-center">
          Houses currently on the market
        </h5>
      </div>
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Address</th>
            <th>Country</th>
            <th>Asking Price</th>
          </tr>
        </thead>
        <tbody>
          {houses.map((h) => (
            <HouseRow key={h.id} house={h} />
          ))}
        </tbody>
      </table>
      <button onClick={addHouse} className="btn btn-primary">
        Add
      </button>
    </>
  );
};

export default HouseList;
