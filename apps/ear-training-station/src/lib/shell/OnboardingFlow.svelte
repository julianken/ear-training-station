<script lang="ts">
  import StepWelcome from './onboarding/StepWelcome.svelte';
  import StepMicPermission from './onboarding/StepMicPermission.svelte';
  import StepConceptIntro from './onboarding/StepConceptIntro.svelte';
  import StepWarmupRound from './onboarding/StepWarmupRound.svelte';

  let step = $state<1 | 2 | 3 | 4>(1);

  const next = () => { step = (step + 1) as typeof step; };
  const back = () => { step = (step - 1) as typeof step; };
</script>

<div class="onboarding">
  <div class="progress" aria-label="Onboarding progress">
    Step {step} of 4
  </div>
  {#if step === 1}
    <StepWelcome onNext={next} />
  {:else if step === 2}
    <StepMicPermission onNext={next} onBack={back} />
  {:else if step === 3}
    <StepConceptIntro onNext={next} onBack={back} />
  {:else}
    <StepWarmupRound onBack={back} />
  {/if}
</div>

<style>
  .onboarding { max-width: 600px; margin: 0 auto; }
  .progress { text-align: center; font-size: 10px; color: var(--muted); margin: 16px 0; }
</style>
