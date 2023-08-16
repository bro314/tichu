define(["dojo", "dojo/_base/declare", "ebg/core/gamegui", "ebg/counter", "ebg/stock"], function (
  dojo: any,
  declare: any
) {
  return declare("bgagame.tichu", ebg.core.gamegui, new Tichu());
});
