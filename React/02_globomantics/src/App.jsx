import Banner from "./components/Banner";
import "./App.css";
import HouseList from "./components/HouseList";
import House from "./components/House";
import ErrorBoundary from "./components/ErrorBoundary";
import ComponentPicker from "./components/ComponentPicker";
import { BrowserRouter, Route, Routes } from "react-router";

function App() {


  return (
    <BrowserRouter>
      <Banner>
        <div>Providing houses all over the world</div>
      </Banner>
      <Routes>
        <Route index element={<HouseList></HouseList>}></Route>
        <Route path="house" element={<House></House>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
