export function sayHello() {
  const playArea = document.getElementById("game_play_area");
  const div = document.createElement("div");
  div.innerText = "Hello!!!";
  playArea?.appendChild(div);
}
