namespace PawCare.Api.Modules.Adoption;
public sealed record AdoptionCreate(long PetId,string Title,string Description,string GeneralArea);
public sealed record AdoptionApply(string Answers);
public sealed record AdoptionDecision(bool Accept);
public sealed record HandoverConfirmation(string IdempotencyKey);
