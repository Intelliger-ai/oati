#!/bin/sh
set -eu

umask 077
mkdir -p /tls
rm -f /tls/ca.crt /tls/ca.key /tls/ca.srl /tls/authorizer.crt /tls/authorizer.csr /tls/authorizer.ext /tls/authorizer.key /tls/envoy-client.crt /tls/envoy-client.csr /tls/envoy-client.ext /tls/envoy-client.key
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tls/ca.key >/dev/null 2>&1
openssl req -x509 -new -key /tls/ca.key -sha256 -days 2 -subj "/CN=OATI integration CA" -out /tls/ca.crt

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tls/authorizer.key >/dev/null 2>&1
openssl req -new -key /tls/authorizer.key -subj "/CN=oati-authz" -out /tls/authorizer.csr
printf '%s\n' "subjectAltName=DNS:oati-authz" "extendedKeyUsage=serverAuth" > /tls/authorizer.ext
openssl x509 -req -in /tls/authorizer.csr -CA /tls/ca.crt -CAkey /tls/ca.key -CAcreateserial -days 2 -sha256 -extfile /tls/authorizer.ext -out /tls/authorizer.crt >/dev/null 2>&1

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tls/envoy-client.key >/dev/null 2>&1
openssl req -new -key /tls/envoy-client.key -subj "/CN=envoy" -out /tls/envoy-client.csr
printf '%s\n' "extendedKeyUsage=clientAuth" > /tls/envoy-client.ext
openssl x509 -req -in /tls/envoy-client.csr -CA /tls/ca.crt -CAkey /tls/ca.key -CAcreateserial -days 2 -sha256 -extfile /tls/envoy-client.ext -out /tls/envoy-client.crt >/dev/null 2>&1

chmod 0444 /tls/ca.crt /tls/authorizer.crt /tls/authorizer.key /tls/envoy-client.crt /tls/envoy-client.key
