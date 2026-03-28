namespace CSharpPerformancePlaybook.Code.Tests;

public class ClassVsStructTests
{
    private List<string> _testNames = File.ReadAllLines("Resources/1000_imion.txt").ToList();
    private readonly ClassVsStruct _sut;

    public ClassVsStructTests()
    {
        _sut = new ClassVsStruct(_testNames);
    }

    [Fact]
    public void BuildPersonClass_ShouldReturnCorrectCount()
    {
        var result = _sut.BuildPersonClass();
        Assert.Equal(819, result.Count);
    }

    [Fact]
    public void BuildPersonClass_ShouldMapNamesCorrectly()
    {
        var result = _sut.BuildPersonClass();
        Assert.Equal(_testNames, result.Select(p => p.Name).ToList());
    }

    [Fact]
    public void BuildPersonStruct_ShouldReturnCorrectCount()
    {
        var result = _sut.BuildPersonStruct();
        Assert.Equal(819, result.Count);
    }

    [Fact]
    public void BuildPersonStruct_ShouldMapNamesCorrectly()
    {
        var result = _sut.BuildPersonStruct();
        Assert.Equal(_testNames, result.Select(p => p.Name).ToList());
    }

    [Fact]
    public void BothMethods_ShouldProduceSameNames()
    {
        var classes = _sut.BuildPersonClass().Select(p => p.Name);
        var structs = _sut.BuildPersonStruct().Select(p => p.Name);
        Assert.Equal(classes, structs);
    }

    [Fact]
    public void BuildPersonClass_WithEmptyList_ShouldReturnEmpty()
    {
        var sut = new ClassVsStruct([]);
        Assert.Empty(sut.BuildPersonClass());
    }
}