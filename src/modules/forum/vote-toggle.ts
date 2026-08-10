export type ExistingVote = { value: number } | null;
export type VoteStore = {
  find(): Promise<ExistingVote>;
  remove(): Promise<void>;
  save(value: number): Promise<void>;
};

export async function toggleVote(store: VoteStore, value: number) {
  const existing = await store.find();
  if (existing?.value === value) {
    await store.remove();
    return { active: false, delta: -value };
  }
  await store.save(value);
  return { active: true, value, delta: existing ? value - existing.value : value };
}

