import { createContext } from "react";
import navValues from "./navValues";

const navigationContext = createContext(navValues.home);

export default navigationContext;