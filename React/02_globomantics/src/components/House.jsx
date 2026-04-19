import currencyFormatter from "../helpers/currencyFormatter";

const House = ({ house }) => {
  // const [visible, setVisibility] = useState(false);
  return (
    <>
      <div className="row">
        <div className="col-6">
          <div className="row">
            <img
              className="img-fluid"
              src={
                house.photo
                  ? `./houseImages/${house.photo}.jpeg`
                  : "./defaultphoto.png"
              }
              alt="House pic"
            />
          </div>
        </div>
        <div className="col-6">
          <div className="row mt-2">
            <h5 className="col-12">{house.country}</h5>
          </div>
          <div className="row mt-2">
            <h5 className="col-12">{house.address}</h5>
          </div>
          <div className="row">
            <h2 className="themeFontColor col-12">
              {currencyFormatter.format(house.price)}
            </h2>
          </div>
          <div className="row">
            <div className="col-12 mt-3">{house.description}</div>
          </div>
        </div>
      </div>
      {/* <div className="row mt-5">
        <button
          onClick={() => setVisibility(!visible)}
          className="btn btn-primary"
        >
          Show
        </button>
        <Activity mode={visible ? "visible" : "hidden"}>
          <textarea placeholder="Write some text"></textarea>
        </Activity>
      </div> */}
    </>
  );
};

export default House;
