using SalegaTech.Api.Tests.Abstractions;
using SalegaTech.Application.Financings;
using Shouldly;
using System.Net;
using System.Net.Http.Json;

namespace SalegaTech.Api.Tests.Simulations
{
    public class SimulationsControllerTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly TestWebApplicationFactory _factory;

        public SimulationsControllerTests(TestWebApplicationFactory factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task Get_Test_Endpoint_Returns_200_With_Simulation_Response()
        {
            // Arrange
            var client = _factory.CreateClient();

            // Act
            var response = await client.GetAsync("/api/simulations/test");

            // Assert
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var result = await response.Content.ReadFromJsonAsync<SimulationResponse>();
            result.ShouldNotBeNull();
            result!.Status.ShouldBe("Approved");
            result.MonthlyPayment.ShouldBeGreaterThan(0);
            result.FinancingType.ShouldBe("LOA");
        }

        [Fact]
        public async Task Post_With_Valid_Request_Returns_202_Accepted_With_SimulationId()
        {
            // Arrange
            var client = _factory.CreateClient();
            var request = new
            {
                amount = 25000m,
                numberOfMonths = 48,
                financingType = "LOA",
                residualValue = 8000m,
                partnerCode = "CONC001"
            };

            // Act
            var response = await client.PostAsJsonAsync("/api/simulations", request);

            // Assert
            response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
            response.Headers.Location.ShouldNotBeNull();
            response.Headers.Location!.ToString().ShouldStartWith("/api/simulations/");
        }

        [Fact]
        public async Task Post_With_Invalid_Amount_Returns_400_BadRequest()
        {
            // Arrange
            var client = _factory.CreateClient();
            var request = new
            {
                amount = 0m,
                numberOfMonths = 48,
                financingType = "LOA",
                residualValue = 8000m,
                partnerCode = "CONC001"
            };

            // Act
            var response = await client.PostAsJsonAsync("/api/simulations", request);

            // Assert
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Post_With_NumberOfMonths_Out_Of_Range_Returns_400_BadRequest()
        {
            // Arrange
            var client = _factory.CreateClient();
            var request = new
            {
                amount = 25000m,
                numberOfMonths = 5,
                financingType = "LOA",
                residualValue = 8000m,
                partnerCode = "CONC001"
            };

            // Act
            var response = await client.PostAsJsonAsync("/api/simulations", request);

            // Assert
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task Get_Unknown_SimulationId_Returns_404_NotFound()
        {
            // Arrange
            var client = _factory.CreateClient();
            var unknownId = Guid.NewGuid();

            // Act
            var response = await client.GetAsync($"/api/simulations/{unknownId}");

            // Assert
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Post_Then_Get_Returns_Stored_SimulationResponse()
        {
            // Arrange
            var client = _factory.CreateClient();
            var request = new
            {
                amount = 25000m,
                numberOfMonths = 48,
                financingType = "LOA",
                residualValue = 8000m,
                partnerCode = "CONC001"
            };

            // Act
            var postResponse = await client.PostAsJsonAsync("/api/simulations", request);
            postResponse.StatusCode.ShouldBe(HttpStatusCode.Accepted);


            var locationPath = postResponse.Headers.Location!.ToString();
            var simulationId = locationPath.Split('/').Last();

       
            await Task.Delay(500);

            // Act
            var getResponse = await client.GetAsync($"/api/simulations/{simulationId}");

            // Assert
            getResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
            var result = await getResponse.Content.ReadFromJsonAsync<SimulationResponse>();
            result.ShouldNotBeNull();
            result!.SimulationId.ShouldBe(simulationId);
            result.Status.ShouldBe("Approved");
        }
    }
}
