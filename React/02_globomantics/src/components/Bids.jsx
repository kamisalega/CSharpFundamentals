import currencyFormatter from "../helpers/currencyFormatter";
import loadingStatus from "../helpers/loadingStatus";
import useBids from "../hooks/useBids";
import LoadingIndicator from "./LoadingIndicator";

const Bids = ({ house }) => {
  const { bids, loadingState, addBid } = useBids(house.id);

  if (loadingState !== loadingStatus.loaded) {
    return <LoadingIndicator loadingState={loadingState} />;
  }

  const bidSubmitAction = async (formData) => {
    await addBid({
      houseId: house.id,
      bidder: formData.get("bidder"),
      amount: formData.get("amount"),
    });
  };

  return (
    <>
      <div className="row mt-4">
        <div className="col-12">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Bidder</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b) => (
                <tr key={b.id}>
                  <td>{b.bidder}</td>
                  <td>{currencyFormatter.format(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form action={bidSubmitAction} className="row row-cols-lg-auto">
        <div className="col-5">
          <input
            id="bidder"
            className="h-100 form-control"
            type="text"
            name="bidder"
            placeholder="Bidder"
          ></input>
        </div>
        <div className="col-5">
          <input
            id="amount"
            className="h-100 form-control"
            type="number"
            name="amount"
            placeholder="Amount"
          ></input>
        </div>
        <div className="col-2">
          <button className="btn btn-primary" type="submit">
            Add
          </button>
        </div>
      </form>
    </>
  );
};

export default Bids;
