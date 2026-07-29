// Command test-package-install verifies the Go SDK and CLI from clean consumer directories.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

const consumer = `package main

import (
    "fmt"
    oati "github.com/Intelliger-ai/oati/sdk/go"
)

func main() {
    canonical, err := oati.CanonicalJSON(map[string]any{"b": 2, "a": 1})
    if err != nil || canonical != "{\"a\":1,\"b\":2}" { panic("canonical JSON export failed") }
    mandate := oati.BuildMandate(map[string]any{"id": "oati:mandate:fresh:install-1"})
    if mandate["oati_version"] != "1.0" { panic("builder export failed") }
    fmt.Println("fresh Go package consumer passed")
}
`

func main() {
	sdkRoot, err := os.Getwd()
	must(err)
	requireApacheLicense(filepath.Join(sdkRoot, "LICENSE"))
	root, err := os.MkdirTemp("", "oati-go-install-")
	must(err)
	defer os.RemoveAll(root)
	consumerRoot := filepath.Join(root, "consumer")
	must(os.Mkdir(consumerRoot, 0o755))
	module := fmt.Sprintf("module example.com/oati-fresh-consumer\n\ngo 1.25.12\n\nrequire github.com/Intelliger-ai/oati/sdk/go v0.0.0\n\nreplace github.com/Intelliger-ai/oati/sdk/go => %s\n", filepath.ToSlash(sdkRoot))
	must(os.WriteFile(filepath.Join(consumerRoot, "go.mod"), []byte(module), 0o644))
	must(os.WriteFile(filepath.Join(consumerRoot, "main.go"), []byte(consumer), 0o644))
	// Disable the repository workspace so both checks prove that each published
	// module is independently consumable from its own go.mod.
	goEnvironment := append(os.Environ(), "GOWORK=off", "GOCACHE="+filepath.Join(root, "go-cache"), "GOMODCACHE="+filepath.Join(root, "go-mod-cache"))
	run(consumerRoot, goEnvironment, "go", "mod", "tidy")
	run(consumerRoot, goEnvironment, "go", "run", ".")

	binRoot := filepath.Join(root, "bin")
	must(os.Mkdir(binRoot, 0o755))
	cliRoot := filepath.Clean(filepath.Join(sdkRoot, "..", "..", "cli"))
	requireApacheLicense(filepath.Join(cliRoot, "LICENSE"))
	run(cliRoot, append(goEnvironment, "GOBIN="+binRoot), "go", "install", "./cmd/oati")
	binary := filepath.Join(binRoot, "oati")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	output, err := exec.Command(binary, "version").CombinedOutput()
	must(err)
	if !strings.HasPrefix(string(output), "oati ") {
		panic("installed CLI did not report its version")
	}
	fmt.Print(string(output))
}

func requireApacheLicense(path string) {
	contents, err := os.ReadFile(path)
	must(err)
	if !strings.Contains(string(contents), "Apache License") || !strings.Contains(string(contents), "Version 2.0, January 2004") {
		panic(path + " does not contain Apache License 2.0")
	}
}

func run(directory string, environment []string, command string, arguments ...string) {
	process := exec.Command(command, arguments...)
	process.Dir = directory
	process.Stdout, process.Stderr = os.Stdout, os.Stderr
	if environment != nil {
		process.Env = environment
	}
	must(process.Run())
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
