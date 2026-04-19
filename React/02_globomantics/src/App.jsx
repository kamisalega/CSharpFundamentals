import Banner from "./components/Banner";
import "./App.css";
import HouseList from "./components/HouseList";
import { Suspense, useState } from "react";
import House from "./components/House";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [selectedHouse, setSelectedHouse] = useState();
  const setSelectedHouseWrapper = (house) => {
    setSelectedHouse(house);
  };

  return (
    <ErrorBoundary fallback="Something went wrong">
      <Banner>Providing houses all over the world</Banner>
      {selectedHouse ? (
        <House house={selectedHouse} />
      ) : (
        <HouseList selectHouse={setSelectedHouseWrapper} />
      )}
    </ErrorBoundary>
  );
}

export default App;
