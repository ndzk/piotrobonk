# One shard of the final measurement on a CI runner: bash scripts/sim/ci-step.sh <step> <station>.
set -eu
V=scripts/sim/data/variants
B="node scripts/sim/bots.ts --watki=4 --od=600 --stacje=$2 --plik=k-$1-$2"
case "$1" in
  casual-spok) $B --boty=casual --runs=8 --kurs=spokojny ;;
  casual-norm) $B --boty=casual --runs=8 ;;
  human-opo) $B --warianty=$V/a.json --runs=6 --kurs=opoznienie ;;
  oracle-top) $B --warianty=$V/oa.json --runs=3 --drabinka=19 ;;
  random) $B --warianty=$V/random.json --runs=1 ;;
esac
