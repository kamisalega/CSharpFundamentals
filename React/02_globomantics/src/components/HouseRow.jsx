import currencyFormatter from "../helpers/currencyFormatter";
import { useNavigate } from "react-router";

const HouseRow = ({ house }) => {
  const navigate = useNavigate();
  return (
    <tr onClick={() => navigate(`/house/${house.id}`)}>
      <td>{house.address}</td>
      <td>{house.country}</td>
      {house.price && (
        <td className={`${house.price >= 500000 ? "text-primary" : ""}`}>
          {currencyFormatter.format(house.price)}
        </td>
      )}
    </tr>
  );
};

export default HouseRow;
