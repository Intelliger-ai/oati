**@intelliger/oati**

***

# @intelliger/oati

## Classes

- [LookupTrustResolver](classes/LookupTrustResolver.md)
- [MemoryReplayCache](classes/MemoryReplayCache.md)
- [OatiError](classes/OatiError.md)
- [OatiLookupClient](classes/OatiLookupClient.md)
- [OatiLookupError](classes/OatiLookupError.md)
- [OatiValidationError](classes/OatiValidationError.md)
- [StaticTrustResolver](classes/StaticTrustResolver.md)

## Interfaces

- [ActionReceipt](interfaces/ActionReceipt.md)
- [AgentMandate](interfaces/AgentMandate.md)
- [AgentPassport](interfaces/AgentPassport.md)
- [AssetMandate](interfaces/AssetMandate.md)
- [AssetStateClaim](interfaces/AssetStateClaim.md)
- [AuthorisationDecision](interfaces/AuthorisationDecision.md)
- [CommerceEvaluationContext](interfaces/CommerceEvaluationContext.md)
- [CommerceReceipt](interfaces/CommerceReceipt.md)
- [CommerceReceiptTerms](interfaces/CommerceReceiptTerms.md)
- [CommerceTerms](interfaces/CommerceTerms.md)
- [Consumption](interfaces/Consumption.md)
- [EvaluationRequest](interfaces/EvaluationRequest.md)
- [EvaluationResult](interfaces/EvaluationResult.md)
- [LookupClientOptions](interfaces/LookupClientOptions.md)
- [LookupOptions](interfaces/LookupOptions.md)
- [OatiErrorOptions](interfaces/OatiErrorOptions.md)
- [OatiJwsProof](interfaces/OatiJwsProof.md)
- [Proof](interfaces/Proof.md)
- [PublicOatiRecord](interfaces/PublicOatiRecord.md)
- [PurchaseMandate](interfaces/PurchaseMandate.md)
- [ReplayCache](interfaces/ReplayCache.md)
- [RevocationStatus](interfaces/RevocationStatus.md)
- [RwaEvaluationContext](interfaces/RwaEvaluationContext.md)
- [RwaMandateTerms](interfaces/RwaMandateTerms.md)
- [RwaReceipt](interfaces/RwaReceipt.md)
- [RwaReceiptTerms](interfaces/RwaReceiptTerms.md)
- [SchemaIssue](interfaces/SchemaIssue.md)
- [SchemaValidationResult](interfaces/SchemaValidationResult.md)
- [SigningOptions](interfaces/SigningOptions.md)
- [TransactionEnvelope](interfaces/TransactionEnvelope.md)
- [TrustedIssuer](interfaces/TrustedIssuer.md)
- [TrustResolver](interfaces/TrustResolver.md)
- [UsageSnapshot](interfaces/UsageSnapshot.md)
- [ValidationResult](interfaces/ValidationResult.md)
- [VerificationIssue](interfaces/VerificationIssue.md)
- [VerificationKey](interfaces/VerificationKey.md)
- [VerificationMethod](interfaces/VerificationMethod.md)
- [VerificationPolicy](interfaces/VerificationPolicy.md)
- [VerificationResult](interfaces/VerificationResult.md)

## Type Aliases

- [DecimalString](type-aliases/DecimalString.md)
- [JsonPrimitive](type-aliases/JsonPrimitive.md)
- [JsonValue](type-aliases/JsonValue.md)
- [OatiAlgorithm](type-aliases/OatiAlgorithm.md)
- [OatiCryptosuite](type-aliases/OatiCryptosuite.md)
- [OatiErrorCode](type-aliases/OatiErrorCode.md)
- [OatiRecordType](type-aliases/OatiRecordType.md)
- [OatiSchemaName](type-aliases/OatiSchemaName.md)
- [ReceiptInput](type-aliases/ReceiptInput.md)
- [VerificationCode](type-aliases/VerificationCode.md)
- [WithoutVersion](type-aliases/WithoutVersion.md)

## Variables

- [COMMERCE\_PROFILE](variables/COMMERCE_PROFILE.md)
- [OATI\_CRYPTO\_PROFILE](variables/OATI_CRYPTO_PROFILE.md)
- [OATI\_PROOF\_TYPE](variables/OATI_PROOF_TYPE.md)
- [OATI\_RECORD\_TYPES](variables/OATI_RECORD_TYPES.md)
- [OATI\_SUPPORTED\_ALGORITHMS](variables/OATI_SUPPORTED_ALGORITHMS.md)
- [RWA\_PROFILE](variables/RWA_PROFILE.md)
- [schemaNames](variables/schemaNames.md)

## Functions

- [assertSchema](functions/assertSchema.md)
- [canonicalize](functions/canonicalize.md)
- [canonicalJson](functions/canonicalJson.md)
- [createAssetStateClaim](functions/createAssetStateClaim.md)
- [createDecision](functions/createDecision.md)
- [createLookupClient](functions/createLookupClient.md)
- [createMandate](functions/createMandate.md)
- [createPassport](functions/createPassport.md)
- [createPurchaseMandate](functions/createPurchaseMandate.md)
- [createReceipt](functions/createReceipt.md)
- [createTransactionEnvelope](functions/createTransactionEnvelope.md)
- [evaluateAuthority](functions/evaluateAuthority.md)
- [getSchema](functions/getSchema.md)
- [passportTrustResolver](functions/passportTrustResolver.md)
- [signDocument](functions/signDocument.md)
- [validateCommerceReceipt](functions/validateCommerceReceipt.md)
- [validateMintMandate](functions/validateMintMandate.md)
- [validateRwaReceipt](functions/validateRwaReceipt.md)
- [validateSchema](functions/validateSchema.md)
- [verifyDocument](functions/verifyDocument.md)
