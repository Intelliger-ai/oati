// Generated from ../../schemas by scripts/generate-schema-bundle.mjs. Do not edit.
export const schemas = {
  "passport": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/v1/passport.schema.json",
    "title": "OATI Agent Passport",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "id",
      "organisation_id",
      "issuer",
      "status",
      "issued_at",
      "expires_at",
      "verification_methods"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:agent:[A-Za-z0-9._:-]+$"
      },
      "organisation_id": {
        "type": "string",
        "pattern": "^oati:org:[A-Za-z0-9._:-]+$"
      },
      "issuer": {
        "type": "string",
        "minLength": 1
      },
      "status": {
        "enum": [
          "active",
          "suspended",
          "revoked",
          "expired"
        ]
      },
      "display_name": {
        "type": "string",
        "maxLength": 200
      },
      "capabilities": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "protocols": {
        "type": "array",
        "items": {
          "enum": [
            "http",
            "grpc",
            "mcp",
            "a2a"
          ]
        },
        "uniqueItems": true
      },
      "assurance_level": {
        "type": "string"
      },
      "verification_methods": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "type",
            "controller",
            "public_key_jwk"
          ],
          "properties": {
            "id": {
              "type": "string"
            },
            "type": {
              "type": "string"
            },
            "controller": {
              "type": "string"
            },
            "public_key_jwk": {
              "type": "object"
            }
          }
        }
      },
      "issued_at": {
        "type": "string",
        "format": "date-time"
      },
      "expires_at": {
        "type": "string",
        "format": "date-time"
      },
      "status_endpoint": {
        "type": "string",
        "format": "uri"
      },
      "proof": {
        "$ref": "#/$defs/proof"
      }
    },
    "$defs": {
      "proof": {
        "type": "object",
        "required": [
          "type",
          "created",
          "verification_method",
          "signature"
        ],
        "properties": {
          "type": {
            "type": "string"
          },
          "created": {
            "type": "string",
            "format": "date-time"
          },
          "verification_method": {
            "type": "string"
          },
          "signature": {
            "type": "string"
          }
        }
      }
    }
  },
  "mandate": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/v1/mandate.schema.json",
    "title": "OATI Agent Mandate",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "id",
      "issuer",
      "subject",
      "purpose",
      "actions",
      "not_before",
      "expires_at",
      "status"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:mandate:[A-Za-z0-9._:-]+$"
      },
      "issuer": {
        "type": "string"
      },
      "subject": {
        "type": "string",
        "pattern": "^oati:agent:[A-Za-z0-9._:-]+$"
      },
      "sponsor": {
        "type": "string"
      },
      "parent_mandate": {
        "type": "string"
      },
      "purpose": {
        "type": "string",
        "minLength": 1
      },
      "actions": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "resources": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "counterparties": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "destinations": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "limits": {
        "type": "object",
        "additionalProperties": true
      },
      "data_use": {
        "type": "object",
        "additionalProperties": true
      },
      "delegation": {
        "type": "object",
        "properties": {
          "allowed": {
            "type": "boolean"
          },
          "max_depth": {
            "type": "integer",
            "minimum": 0
          }
        }
      },
      "not_before": {
        "type": "string",
        "format": "date-time"
      },
      "expires_at": {
        "type": "string",
        "format": "date-time"
      },
      "status": {
        "enum": [
          "active",
          "suspended",
          "revoked",
          "expired",
          "consumed"
        ]
      },
      "profile": {
        "type": "string",
        "format": "uri"
      },
      "extensions": {
        "type": "object",
        "additionalProperties": true
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "envelope": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/v1/transaction-envelope.schema.json",
    "title": "OATI Agent Transaction Envelope",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "id",
      "agent_id",
      "organisation_id",
      "mandate_id",
      "action",
      "resource",
      "issued_at",
      "nonce"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:tx:[A-Za-z0-9._:-]+$"
      },
      "agent_id": {
        "type": "string"
      },
      "organisation_id": {
        "type": "string"
      },
      "mandate_id": {
        "type": "string"
      },
      "action": {
        "type": "string"
      },
      "resource": {
        "type": "string"
      },
      "purpose": {
        "type": "string"
      },
      "destination": {
        "type": "string"
      },
      "protocol": {
        "enum": [
          "http",
          "grpc",
          "mcp",
          "a2a"
        ]
      },
      "commercial_profile": {
        "type": "string"
      },
      "request_digest": {
        "type": "string"
      },
      "issued_at": {
        "type": "string",
        "format": "date-time"
      },
      "nonce": {
        "type": "string",
        "minLength": 16
      },
      "profile": {
        "type": "string",
        "format": "uri"
      },
      "extensions": {
        "type": "object",
        "additionalProperties": true
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "decision": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/v1/decision.schema.json",
    "title": "OATI Authorisation Decision",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "id",
      "transaction_id",
      "decision",
      "policy_digest",
      "decided_at",
      "issuer"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:decision:[A-Za-z0-9._:-]+$"
      },
      "transaction_id": {
        "type": "string",
        "pattern": "^oati:tx:[A-Za-z0-9._:-]+$"
      },
      "decision": {
        "enum": [
          "allow",
          "deny",
          "transform",
          "approval_required"
        ]
      },
      "policy_digest": {
        "type": "string",
        "minLength": 1
      },
      "reason_codes": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "uniqueItems": true
      },
      "obligations": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "decided_at": {
        "type": "string",
        "format": "date-time"
      },
      "expires_at": {
        "type": "string",
        "format": "date-time"
      },
      "issuer": {
        "type": "string",
        "minLength": 1
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "receipt": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/v1/receipt.schema.json",
    "title": "OATI Action Receipt",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "id",
      "transaction_id",
      "agent_id",
      "organisation_id",
      "mandate_id",
      "decision",
      "outcome",
      "occurred_at",
      "issuer",
      "proof"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:receipt:[A-Za-z0-9._:-]+$"
      },
      "transaction_id": {
        "type": "string"
      },
      "agent_id": {
        "type": "string"
      },
      "organisation_id": {
        "type": "string"
      },
      "mandate_id": {
        "type": "string"
      },
      "decision": {
        "enum": [
          "allow",
          "deny",
          "transform",
          "approval_required"
        ]
      },
      "outcome": {
        "enum": [
          "succeeded",
          "failed",
          "denied",
          "pending",
          "unknown"
        ]
      },
      "policy_digest": {
        "type": "string"
      },
      "request_digest": {
        "type": "string"
      },
      "response_digest": {
        "type": "string"
      },
      "commercial_profile": {
        "type": "string"
      },
      "occurred_at": {
        "type": "string",
        "format": "date-time"
      },
      "issuer": {
        "type": "string"
      },
      "profile": {
        "type": "string",
        "format": "uri"
      },
      "extensions": {
        "type": "object",
        "additionalProperties": true
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "commerceOffer": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/merchant-service-profile.schema.json",
    "title": "OATI Commerce Merchant Service Profile",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "profile",
      "id",
      "merchant_organisation_id",
      "name",
      "endpoint",
      "protocol",
      "actions",
      "offers",
      "status",
      "issued_at",
      "expires_at",
      "issuer",
      "proof"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "profile": {
        "const": "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:service:[A-Za-z0-9._:-]+$"
      },
      "merchant_organisation_id": {
        "type": "string",
        "pattern": "^oati:org:[A-Za-z0-9._:-]+$"
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "endpoint": {
        "type": "string",
        "format": "uri"
      },
      "protocol": {
        "enum": [
          "http",
          "grpc",
          "mcp",
          "a2a"
        ]
      },
      "actions": {
        "type": "array",
        "minItems": 1,
        "uniqueItems": true,
        "items": {
          "type": "string"
        }
      },
      "offers": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "currency",
            "unit",
            "unit_price",
            "billing_model",
            "terms_uri",
            "terms_digest"
          ],
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "currency": {
              "type": "string",
              "pattern": "^[A-Z]{3}$"
            },
            "unit": {
              "type": "string",
              "minLength": 1
            },
            "unit_price": {
              "type": "string",
              "pattern": "^(0|[1-9][0-9]*)(\\.[0-9]+)?$"
            },
            "billing_model": {
              "enum": [
                "per_request",
                "per_unit",
                "subscription",
                "fixed"
              ]
            },
            "terms_uri": {
              "type": "string",
              "format": "uri"
            },
            "terms_digest": {
              "type": "string",
              "minLength": 8
            }
          }
        }
      },
      "data_use": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "purposes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "uniqueItems": true
          },
          "redistribution": {
            "enum": [
              "prohibited",
              "restricted",
              "allowed"
            ]
          },
          "retention_seconds": {
            "type": "integer",
            "minimum": 0
          },
          "destinations": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "uniqueItems": true
          }
        }
      },
      "status": {
        "enum": [
          "active",
          "suspended",
          "retired"
        ]
      },
      "issued_at": {
        "type": "string",
        "format": "date-time"
      },
      "expires_at": {
        "type": "string",
        "format": "date-time"
      },
      "issuer": {
        "type": "string"
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "commerceMandate": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/purchase-mandate.schema.json",
    "title": "OATI Commerce Purchase Mandate",
    "allOf": [
      {
        "$ref": "https://schemas.intelliger.ai/oati/v1/mandate.schema.json"
      },
      {
        "type": "object",
        "required": [
          "profile",
          "extensions"
        ],
        "properties": {
          "profile": {
            "const": "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"
          },
          "extensions": {
            "type": "object",
            "required": [
              "commerce"
            ],
            "properties": {
              "commerce": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "merchant_organisation_id",
                  "service_id",
                  "offer_id",
                  "currency",
                  "max_unit_price",
                  "max_total",
                  "max_quantity"
                ],
                "properties": {
                  "merchant_organisation_id": {
                    "type": "string"
                  },
                  "service_id": {
                    "type": "string"
                  },
                  "offer_id": {
                    "type": "string"
                  },
                  "currency": {
                    "type": "string",
                    "pattern": "^[A-Z]{3}$"
                  },
                  "max_unit_price": {
                    "type": "string",
                    "pattern": "^(0|[1-9][0-9]*)(\\.[0-9]+)?$"
                  },
                  "max_total": {
                    "type": "string",
                    "pattern": "^(0|[1-9][0-9]*)(\\.[0-9]+)?$"
                  },
                  "max_quantity": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "billing_model": {
                    "enum": [
                      "per_request",
                      "per_unit",
                      "subscription",
                      "fixed"
                    ]
                  },
                  "terms_digest": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "commerceReceipt": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/commerce/v0.1/commerce-receipt.schema.json",
    "title": "OATI Commerce Action Receipt",
    "allOf": [
      {
        "$ref": "https://schemas.intelliger.ai/oati/v1/receipt.schema.json"
      },
      {
        "type": "object",
        "required": [
          "profile",
          "extensions"
        ],
        "properties": {
          "profile": {
            "const": "https://specs.intelliger.ai/oati/profiles/commerce/v0.1"
          },
          "extensions": {
            "type": "object",
            "required": [
              "commerce"
            ],
            "properties": {
              "commerce": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "merchant_organisation_id",
                  "service_id",
                  "offer_id",
                  "currency",
                  "quantity",
                  "unit_price",
                  "total_amount",
                  "fulfilment_status",
                  "terms_digest"
                ],
                "properties": {
                  "merchant_organisation_id": {
                    "type": "string"
                  },
                  "service_id": {
                    "type": "string"
                  },
                  "offer_id": {
                    "type": "string"
                  },
                  "currency": {
                    "type": "string",
                    "pattern": "^[A-Z]{3}$"
                  },
                  "quantity": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "unit_price": {
                    "type": "string"
                  },
                  "total_amount": {
                    "type": "string"
                  },
                  "billing_reference": {
                    "type": "string"
                  },
                  "fulfilment_status": {
                    "enum": [
                      "fulfilled",
                      "partial",
                      "failed",
                      "refunded"
                    ]
                  },
                  "terms_digest": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "rwaAsset": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-profile.schema.json",
    "title": "OATI RWA Asset Profile",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "profile",
      "id",
      "issuer_organisation_id",
      "name",
      "asset_class",
      "jurisdiction",
      "unit",
      "token",
      "authorised_roles",
      "status",
      "issued_at",
      "expires_at",
      "issuer",
      "proof"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "profile": {
        "const": "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:asset:[A-Za-z0-9._:-]+$"
      },
      "issuer_organisation_id": {
        "type": "string",
        "pattern": "^oati:org:[A-Za-z0-9._:-]+$"
      },
      "name": {
        "type": "string",
        "minLength": 1
      },
      "asset_class": {
        "enum": [
          "tokenised_fund",
          "private_credit",
          "reserve_backed",
          "commodity_backed",
          "other"
        ]
      },
      "jurisdiction": {
        "type": "string",
        "minLength": 2
      },
      "unit": {
        "type": "string",
        "minLength": 1
      },
      "token": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "network",
          "contract",
          "standard"
        ],
        "properties": {
          "network": {
            "type": "string"
          },
          "contract": {
            "type": "string"
          },
          "standard": {
            "type": "string"
          }
        }
      },
      "authorised_roles": {
        "type": "array",
        "minItems": 1,
        "uniqueItems": true,
        "items": {
          "enum": [
            "issuer",
            "custodian",
            "administrator",
            "oracle",
            "auditor",
            "operator",
            "approver"
          ]
        }
      },
      "state_policy": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "max_claim_age_seconds": {
            "type": "integer",
            "minimum": 1
          },
          "required_claim_type": {
            "type": "string"
          },
          "minimum_approvals": {
            "type": "integer",
            "minimum": 1
          }
        }
      },
      "status": {
        "enum": [
          "active",
          "suspended",
          "retired"
        ]
      },
      "issued_at": {
        "type": "string",
        "format": "date-time"
      },
      "expires_at": {
        "type": "string",
        "format": "date-time"
      },
      "issuer": {
        "type": "string"
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "rwaStateClaim": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-state-claim.schema.json",
    "title": "OATI RWA Asset State Claim",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "oati_version",
      "profile",
      "id",
      "asset_id",
      "claim_type",
      "value",
      "unit",
      "observed_at",
      "valid_until",
      "issuer",
      "issuer_role",
      "evidence",
      "proof"
    ],
    "properties": {
      "oati_version": {
        "const": "1.0"
      },
      "profile": {
        "const": "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
      },
      "id": {
        "type": "string",
        "pattern": "^oati:claim:[A-Za-z0-9._:-]+$"
      },
      "asset_id": {
        "type": "string",
        "pattern": "^oati:asset:[A-Za-z0-9._:-]+$"
      },
      "claim_type": {
        "enum": [
          "reserve_balance",
          "nav",
          "eligibility",
          "covenant",
          "custody",
          "collateral"
        ]
      },
      "value": {
        "type": "string",
        "pattern": "^(0|[1-9][0-9]*)(\\.[0-9]+)?$"
      },
      "unit": {
        "type": "string"
      },
      "observed_at": {
        "type": "string",
        "format": "date-time"
      },
      "valid_until": {
        "type": "string",
        "format": "date-time"
      },
      "issuer": {
        "type": "string"
      },
      "issuer_role": {
        "enum": [
          "custodian",
          "administrator",
          "oracle",
          "auditor"
        ]
      },
      "evidence": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "digest",
          "media_type"
        ],
        "properties": {
          "uri": {
            "type": "string",
            "format": "uri"
          },
          "digest": {
            "type": "string",
            "minLength": 8
          },
          "media_type": {
            "type": "string"
          }
        }
      },
      "proof": {
        "type": "object"
      }
    }
  },
  "rwaMandate": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/asset-mandate.schema.json",
    "title": "OATI RWA Asset Mandate",
    "allOf": [
      {
        "$ref": "https://schemas.intelliger.ai/oati/v1/mandate.schema.json"
      },
      {
        "type": "object",
        "required": [
          "profile",
          "extensions"
        ],
        "properties": {
          "profile": {
            "const": "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
          },
          "extensions": {
            "type": "object",
            "required": [
              "rwa"
            ],
            "properties": {
              "rwa": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "asset_id",
                  "state_claim_id",
                  "network",
                  "token_contract",
                  "operation",
                  "unit",
                  "max_quantity",
                  "one_time",
                  "minimum_approvals"
                ],
                "properties": {
                  "asset_id": {
                    "type": "string"
                  },
                  "state_claim_id": {
                    "type": "string"
                  },
                  "network": {
                    "type": "string"
                  },
                  "token_contract": {
                    "type": "string"
                  },
                  "operation": {
                    "enum": [
                      "mint",
                      "burn",
                      "transfer",
                      "redeem",
                      "publish_state"
                    ]
                  },
                  "unit": {
                    "type": "string"
                  },
                  "max_quantity": {
                    "type": "string",
                    "pattern": "^(0|[1-9][0-9]*)(\\.[0-9]+)?$"
                  },
                  "one_time": {
                    "type": "boolean"
                  },
                  "minimum_approvals": {
                    "type": "integer",
                    "minimum": 1
                  },
                  "required_roles": {
                    "type": "array",
                    "uniqueItems": true,
                    "items": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  },
  "rwaReceipt": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://schemas.intelliger.ai/oati/profiles/rwa/v0.1/rwa-receipt.schema.json",
    "title": "OATI RWA Action Receipt",
    "allOf": [
      {
        "$ref": "https://schemas.intelliger.ai/oati/v1/receipt.schema.json"
      },
      {
        "type": "object",
        "required": [
          "profile",
          "extensions"
        ],
        "properties": {
          "profile": {
            "const": "https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
          },
          "extensions": {
            "type": "object",
            "required": [
              "rwa"
            ],
            "properties": {
              "rwa": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "asset_id",
                  "state_claim_id",
                  "operation",
                  "network",
                  "token_contract",
                  "quantity",
                  "unit",
                  "chain_transaction_hash",
                  "approval_count"
                ],
                "properties": {
                  "asset_id": {
                    "type": "string"
                  },
                  "state_claim_id": {
                    "type": "string"
                  },
                  "operation": {
                    "enum": [
                      "mint",
                      "burn",
                      "transfer",
                      "redeem",
                      "publish_state"
                    ]
                  },
                  "network": {
                    "type": "string"
                  },
                  "token_contract": {
                    "type": "string"
                  },
                  "quantity": {
                    "type": "string"
                  },
                  "unit": {
                    "type": "string"
                  },
                  "chain_transaction_hash": {
                    "type": "string"
                  },
                  "approval_count": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "resulting_supply": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
} as const
