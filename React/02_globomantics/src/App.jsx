import Banner from "./components/Banner";
import "./App.css";
import HouseList from "./components/HouseList";
import { Suspense } from "react";

function App() {
  return (
    <>
      <Banner>Providing houses all over the world</Banner>
      <HouseList />
    </>
  );
}

export default App;
