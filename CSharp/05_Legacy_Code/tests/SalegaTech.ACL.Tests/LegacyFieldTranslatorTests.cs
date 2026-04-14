using SalegaTech.ACL.Translators;
using SalegaTech.Domain.Enums;
using Shouldly;

namespace SalegaTech.ACL.Tests
{
    public class LegacyFieldTranslatorTests
    {
        
        [Fact]
        public void RateFromHundredths_499_ShouldReturn4Point99()
        {
            var result = LegacyFieldTranslator.RateFromHundredths(499);

            result.IsSuccess.ShouldBeTrue();
            result.Value.ValueAsPercentage.ShouldBe(4.99m);
        }

        [Fact]
        public void RateFromHundredths_0_ShouldReturnZero()
        {
            var result = LegacyFieldTranslator.RateFromHundredths(0);

            result.IsSuccess.ShouldBeTrue();
            result.Value.ValueAsPercentage.ShouldBe(0m);
        }


        [Fact]
        public void DateFromYyyyMmDd_ValidFormat_ShouldParse()
        {
            var result = LegacyFieldTranslator.DateFromYyyyMmDd("20260412");

            result.IsSuccess.ShouldBeTrue();
            result.Value.ShouldBe(new DateOnly(2026, 4, 12));
        }

        [Fact]
        public void DateFromYyyyMmDd_EmptyString_ShouldFail()
        {
            var result = LegacyFieldTranslator.DateFromYyyyMmDd("");

            result.IsFailure.ShouldBeTrue();
            result.Error.Code.ShouldBe("Legacy.InvalidDateFormat");
        }

        [Fact]
        public void DateFromYyyyMmDd_InvalidFormat_ShouldFail()
        {
            var result = LegacyFieldTranslator.DateFromYyyyMmDd("2026-04-12");

            result.IsFailure.ShouldBeTrue();
        }

        [Fact]
        public void DateFromYyyyMmDd_InvalidDate_ShouldFail()
        {
            var result = LegacyFieldTranslator.DateFromYyyyMmDd("20260230");

            result.IsFailure.ShouldBeTrue();
        }
        

        [Theory]
        [InlineData(0, SimulationStatus.Rejected)]
        [InlineData(1, SimulationStatus.Approved)]
        [InlineData(2, SimulationStatus.Pending)]
        public void StatusFromCode_KnownCode_ShouldMap(int code, SimulationStatus expected)
        {
            var result = LegacyFieldTranslator.StatusFromCode(code);

            result.IsSuccess.ShouldBeTrue();
            result.Value.ShouldBe(expected);
        }

        [Fact]
        public void StatusFromCode_Unknown_ShouldFail()
        {
            var result = LegacyFieldTranslator.StatusFromCode(99);

            result.IsFailure.ShouldBeTrue();
            result.Error.Code.ShouldBe("Legacy.UnknownStatus");
        }


        [Theory]
        [InlineData("LOA", FinancingType.LOA)]
        [InlineData("CC", FinancingType.ClassicCredit)]
        [InlineData("LLD", FinancingType.LLD)]
        [InlineData("loa", FinancingType.LOA)] 
        public void FinancingTypeFromCode_Known_ShouldMap(string code, FinancingType expected)
        {
            var result = LegacyFieldTranslator.FinancingTypeFromCode(code);

            result.IsSuccess.ShouldBeTrue();
            result.Value.ShouldBe(expected);
        }

        [Fact]
        public void FinancingTypeFromCode_Unknown_ShouldFail()
        {
            var result = LegacyFieldTranslator.FinancingTypeFromCode("XYZ");

            result.IsFailure.ShouldBeTrue();
        }
    }
}
