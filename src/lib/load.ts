// Reads the real data files and hands the poster grid its movie list.
import raw from '../data/movies.json';
import aliases from '../../data/aliases.json';
import ratings from '../../data/ratings.json';
import { toGridMovies, type GridMovie, type RawMovie } from './movies';

export function loadGridMovies(): GridMovie[] {
  return toGridMovies(raw as RawMovie[], aliases as Record<string, string>, ratings as Record<string, string>);
}
