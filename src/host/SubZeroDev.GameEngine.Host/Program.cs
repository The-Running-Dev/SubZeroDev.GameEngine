using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using SubZeroDev.Platform.Hosting;

var builder = WebApplication.CreateBuilder(args);

// The only Platform call this host makes -- design/15-platform-static-host.md §2. No
// worker, persistence, migration, outbox, account, or session facility is added: this
// host is a delivery surround for a static artifact, not a game service.
builder.AddPlatformWebHost();

var app = builder.Build();

// §4/§7: successful startup means the baked artifact was already validated. A missing or
// incomplete artifact must fail startup rather than serve whichever files happen to exist
// -- this is what lets CI's deliberate missing/corrupt-artifact fixture (W62.7) prove the
// gate fails red instead of silently shipping a partial site.
var missing = StaticArtifact.FindMissingRequiredDocuments(app.Environment.WebRootPath);
if (missing.Count > 0)
{
    app.Logger.LogCritical(
        "Static artifact is incomplete; refusing to start. Missing: {Missing}",
        string.Join(", ", missing));
    return 1;
}

app.MapPlatformProbes();

// No SPA fallback (§4): UseDefaultFiles only resolves a directory request ("/",
// "/roadmap/", "/play/", "/docs/") to that directory's own index.html. An unknown route
// falls through both middleware with nothing left to handle it, which is what makes it a
// 404 rather than the landing page. Static bytes are served exactly as baked, never
// rewritten by the host.
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(app.Environment.WebRootPath),
    ServeUnknownFileTypes = false,
});

app.Run();
return 0;

/// <summary>The routes W62.4 requires the container to serve directly, and the check that
/// keeps a missing or corrupted artifact from ever reaching a "healthy" container.</summary>
internal static class StaticArtifact
{
    private static readonly string[] RequiredRelativePaths =
    [
        "index.html",
        "roadmap/index.html",
        "play/index.html",
        "docs/index.html",
    ];

    internal static IReadOnlyList<string> FindMissingRequiredDocuments(string webRootPath)
    {
        if (!Directory.Exists(webRootPath))
        {
            return RequiredRelativePaths;
        }

        return RequiredRelativePaths
            .Where(relative => !File.Exists(Path.Combine(webRootPath, relative.Replace('/', Path.DirectorySeparatorChar))))
            .ToArray();
    }
}

/// <summary>Entry point marker so <c>WebApplicationFactory&lt;Program&gt;</c> can boot this host
/// from tests without a separate internals-visibility declaration.</summary>
public partial class Program;
