using Xunit;

namespace SubZeroDev.GameEngine.Host.Tests;

public sealed class StaticArtifactTests
{
    [Fact]
    public void AllRequiredDocumentsPresent_ReportsNothingMissing()
    {
        var root = CreateTempRoot();
        try
        {
            WriteRequiredDocuments(root);

            var missing = StaticArtifact.FindMissingRequiredDocuments(root);

            Assert.Empty(missing);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void MissingWebRoot_ReportsEveryRequiredDocumentMissing()
    {
        var root = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());

        var missing = StaticArtifact.FindMissingRequiredDocuments(root);

        Assert.Equal(3, missing.Count);
    }

    [Theory]
    [InlineData("index.html")]
    [InlineData("roadmap/index.html")]
    [InlineData("docs/index.html")]
    public void OneCorruptedOrMissingDocument_IsReportedByItself(string relativePath)
    {
        var root = CreateTempRoot();
        try
        {
            WriteRequiredDocuments(root);
            File.Delete(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));

            var missing = StaticArtifact.FindMissingRequiredDocuments(root);

            var missingRelative = Assert.Single(missing);
            Assert.Equal(relativePath, missingRelative);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private static string CreateTempRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(root);
        return root;
    }

    private static void WriteRequiredDocuments(string root)
    {
        WriteDocument(root, "index.html");
        WriteDocument(root, "roadmap/index.html");
        WriteDocument(root, "docs/index.html");
    }

    private static void WriteDocument(string root, string relativePath)
    {
        var fullPath = Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        File.WriteAllText(fullPath, "<html></html>");
    }
}
