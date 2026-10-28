using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Xml.Serialization;

namespace OrdersLegacy
{
    // HttpListener + XmlSerializer: no ASP.NET, no JSON, no routing framework.
    //   GET  /health             -> 200 text
    //   GET  /orders/{id}        -> 200 <Order/> | 404
    //   POST /orders             <- <PlaceOrderRequest/>  -> 201 <Order/>
    //   POST /orders/{id}/ship   -> 204 | 404
    public class OrdersHttpServer
    {
        private static readonly XmlSerializer OrderSerializer = new XmlSerializer(typeof(LegacyOrder));
        private static readonly XmlSerializer RequestSerializer = new XmlSerializer(typeof(PlaceOrderRequest));

        private readonly HttpListener _listener = new HttpListener();
        private readonly OrderRepository _repository;

        public OrdersHttpServer(string prefix, OrderRepository repository)
        {
            _repository = repository;
            _listener.Prefixes.Add(prefix);
        }

        public void Run()
        {
            _listener.Start();

            while (true)
            {
                HttpListenerContext context = _listener.GetContext();

                // Anonymous method - lambdas only arrived in C# 3.0.
                ThreadPool.QueueUserWorkItem(delegate { Handle(context); });
            }
        }

        private void Handle(HttpListenerContext context)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            try
            {
                string[] segments = request.Url.AbsolutePath.Trim('/').Split('/');

                if (request.HttpMethod == "GET" && segments.Length == 1 && segments[0] == "health")
                {
                    WriteText(response, 200, "OK " + typeof(OrdersHttpServer).Assembly.ImageRuntimeVersion);
                }
                else if (request.HttpMethod == "GET" && segments.Length == 2 && segments[0] == "orders")
                {
                    LegacyOrder order = _repository.GetById(new Guid(segments[1]));
                    if (order == null)
                    {
                        WriteText(response, 404, "Order not found");
                    }
                    else
                    {
                        WriteOrder(response, 200, order);
                    }
                }
                else if (request.HttpMethod == "POST" && segments.Length == 1 && segments[0] == "orders")
                {
                    PlaceOrderRequest body = (PlaceOrderRequest)RequestSerializer.Deserialize(request.InputStream);
                    Guid id = _repository.Insert(body.CustomerEmail, body.Total);
                    WriteOrder(response, 201, _repository.GetById(id));
                }
                else if (request.HttpMethod == "POST" && segments.Length == 3 && segments[0] == "orders" && segments[2] == "ship")
                {
                    bool shipped = _repository.MarkAsShipped(new Guid(segments[1]));
                    response.StatusCode = shipped ? 204 : 404;
                }
                else
                {
                    WriteText(response, 404, "Unknown route");
                }
            }
            catch (Exception exception)
            {
                Console.WriteLine("ERROR {0} {1}: {2}", request.HttpMethod, request.Url, exception);
                WriteText(response, 500, exception.Message);
            }
            finally
            {
                response.Close();
            }
        }

        private static void WriteOrder(HttpListenerResponse response, int statusCode, LegacyOrder order)
        {
            response.StatusCode = statusCode;
            response.ContentType = "application/xml";

            MemoryStream buffer = new MemoryStream();
            OrderSerializer.Serialize(buffer, order);
            response.ContentLength64 = buffer.Length;
            buffer.WriteTo(response.OutputStream);
        }

        private static void WriteText(HttpListenerResponse response, int statusCode, string text)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(text);
            response.StatusCode = statusCode;
            response.ContentType = "text/plain";
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
        }
    }
}
