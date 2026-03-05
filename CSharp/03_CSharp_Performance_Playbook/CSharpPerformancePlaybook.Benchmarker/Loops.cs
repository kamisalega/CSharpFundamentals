using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Mathematics;
using BenchmarkDotNet.Order;

namespace CSharpPerformancePlaybook.Benchmarker;

[Orderer(SummaryOrderPolicy.FastestToSlowest)]
[RankColumn(NumeralSystem.Arabic)]
public class Loops
{
    public List<string> Names => File.ReadAllLines("Resources/1000_imion.txt").ToList();

    [Benchmark]
    public void ForLoop()
    {
        var names = Names;
        var length = names.Count;

        for (int i = 0; i < length; i++)
        {
            var x = names[i];
        }
    }

    [Benchmark]
    public void ForeachLoop()
    {
        var names = Names;
        
        foreach (var name in names)
        {
            var x = name;
        }
    }
}