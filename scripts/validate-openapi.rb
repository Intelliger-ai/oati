#!/usr/bin/env ruby
require "yaml"

def load_contract(path)
  YAML.safe_load_file(path, aliases: true)
rescue Psych::Exception => error
  abort "#{path}: invalid YAML: #{error.message}"
end

def assert(condition, message)
  abort message unless condition
end

def validate(document, path)
  assert(document["openapi"].to_s.start_with?("3.1."), "#{path}: OpenAPI 3.1 is required")
  assert(document.dig("info", "title").is_a?(String), "#{path}: info.title is required")
  assert(document.dig("info", "version").is_a?(String), "#{path}: info.version is required")
  assert(document["paths"].is_a?(Hash) && !document["paths"].empty?, "#{path}: paths are required")
  operation_ids = []
  document["paths"].each do |route, path_item|
    assert(route.start_with?("/"), "#{path}: invalid path #{route}")
    path_item.each do |method, operation|
      next unless %w[get post put patch delete options head trace].include?(method)
      assert(operation["responses"].is_a?(Hash) && !operation["responses"].empty?, "#{path}: #{method.upcase} #{route} needs responses")
      id = operation["operationId"]
      assert(id.is_a?(String) && !id.empty?, "#{path}: #{method.upcase} #{route} needs operationId")
      assert(!operation_ids.include?(id), "#{path}: duplicate operationId #{id}")
      operation_ids << id
    end
  end
  refs = document.to_s.scan(/#\/components\/schemas\/[A-Za-z0-9._-]+/).uniq
  refs.each { |ref| assert(document.dig("components", "schemas", ref.split("/").last), "#{path}: unresolved #{ref}") }
end

def compatible!(public_contract, platform_contract)
  platform_contract.fetch("paths").each do |route, path_item|
    assert(public_contract.dig("paths", route), "public API removed platform path #{route}")
    path_item.each do |method, operation|
      next unless %w[get post put patch delete options head trace].include?(method)
      public_operation = public_contract.dig("paths", route, method)
      assert(public_operation, "public API removed platform operation #{method.upcase} #{route}")
      required_parameters = operation.fetch("parameters", []).select { |item| item["required"] }.map { |item| [item["in"], item["name"]] }
      public_parameters = public_operation.fetch("parameters", []).map { |item| [item["in"], item["name"]] }
      required_parameters.each { |parameter| assert(public_parameters.include?(parameter), "public API removed required parameter #{parameter.join(":")}") }
      operation.fetch("responses").each_key { |status| assert(public_operation.dig("responses", status), "public API removed platform response #{status} from #{method.upcase} #{route}") }
    end
  end
  platform_schema = platform_contract.dig("components", "schemas", "PublicRecord")
  public_schema = public_contract.dig("components", "schemas", "PublicRecord")
  platform_schema.fetch("required").each { |field| assert(public_schema.fetch("required").include?(field), "public record no longer requires platform field #{field}") }
  platform_schema.fetch("properties").each_key { |field| assert(public_schema.fetch("properties").key?(field), "public record removed platform field #{field}") }
  platform_types = platform_contract.dig("paths", "/lookup", "get", "parameters", 0, "schema", "enum")
  public_types = public_contract.dig("paths", "/lookup", "get", "parameters", 0, "schema", "enum")
  platform_types.each { |type| assert(public_types.include?(type), "public lookup removed platform record type #{type}") }
end

root = File.expand_path("..", __dir__)
public_path = ARGV[0] || File.join(root, "api", "lookup.openapi.yaml")
platform_path = ARGV[1] || File.join(root, "compatibility", "platform-lookup.openapi.yaml")
public_contract = load_contract(public_path)
platform_contract = load_contract(platform_path)
validate(public_contract, public_path)
validate(platform_contract, platform_path)
compatible!(public_contract, platform_contract)
puts "OpenAPI and platform compatibility checks passed"
