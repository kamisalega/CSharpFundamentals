using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Mathematics;
using BenchmarkDotNet.Order;

namespace CSharpPerformancePlaybook.Benchmarker;

[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn(NumeralSystem.Arabic)]
public class ClassVsStruct
{
    public List<string> Names => new Loops().Names;

    [Benchmark]
    public void ThousandClasses()
    {
        var classes = Names.Select(x => new PersonClass() { Name = x });
        
    }

    [Benchmark]
    public void ThousandStructs()
    {
        var classes = Names.Select(x => new PersonStruct() { Name = x });
        
    }
}