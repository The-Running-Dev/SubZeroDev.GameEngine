using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SubZeroDev.GameEngine.Host.Tests;

/// <summary>Boots the real host (§62.1, §62.4) against a temporary content root carrying a
/// minimal but complete static artifact, and proves the routes, probes, and 404 behaviour
/// design/15-platform-static-host.md §4 and §7 require.</summary>
public sealed class HostRoutingTests : IClassFixture<HostRoutingTests.Fixture>
{
    private readonly Fixture _fixture;

    public HostRoutingTests(Fixture fixture) => _fixture = fixture;

    [Theory]
    [InlineData("/")]
    [InlineData("/roadmap/")]
    [InlineData("/docs/")]
    public async Task DirectRouteRequest_ReturnsTheExpectedDocument(string path)
    {
        using var client = _fixture.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains(RouteMarker(path), body);
    }

    [Fact]
    public async Task UnknownRoute_Returns404_NoSpaFallback()
    {
        using var client = _fixture.CreateClient();

        var response = await client.GetAsync("/this-route-does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task PlatformProbes_Succeed(string path)
    {
        using var client = _fixture.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task NoEngineOrGameActionEndpointExists()
    {
        // §5: the container exposes no engine API, game action, or runtime content endpoint.
        // Static files aside, the only routes this host can ever serve are the probes.
        using var client = _fixture.CreateClient();

        foreach (var path in new[] { "/api", "/api/action", "/game", "/mcp" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }

    private static string RouteMarker(string path) => path switch
    {
        "/" => "home",
        "/roadmap/" => "roadmap",
        "/docs/" => "docs",
        _ => throw new ArgumentOutOfRangeException(nameof(path)),
    };

    public sealed class Fixture : WebApplicationFactory<Program>, IDisposable
    {
        private readonly string _contentRoot;

        public Fixture()
        {
            _contentRoot = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
            var wwwroot = Path.Combine(_contentRoot, "wwwroot");
            Directory.CreateDirectory(wwwroot);

            File.WriteAllText(Path.Combine(_contentRoot, "appsettings.json"), TestAppSettings);

            WriteDocument(wwwroot, "index.html", "home");
            WriteDocument(wwwroot, "roadmap/index.html", "roadmap");
            WriteDocument(wwwroot, "docs/index.html", "docs");
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseContentRoot(_contentRoot);
            builder.UseEnvironment("Development");
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing && Directory.Exists(_contentRoot))
            {
                Directory.Delete(_contentRoot, recursive: true);
            }
        }

        private static void WriteDocument(string wwwroot, string relativePath, string marker)
        {
            var fullPath = Path.Combine(wwwroot, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            File.WriteAllText(fullPath, $"<html>{marker}</html>");
        }

        private const string TestAppSettings = """
            {
              "Platform": {
                "ServiceName": "SubZeroDev.GameEngine.Host.Tests",
                "Persistence": {
                  "Provider": "Sqlite",
                  "ConnectionString": "Data Source=unused"
                },
                "Outbox": {
                  "ProcessedRetention": "1.00:00:00",
                  "PoisonedRetention": "2.00:00:00"
                }
              }
            }
            """;
    }
}
